/* ====================================================================
   POST /api/ability-diagnosis

   接收学生的历史成绩（可能是空的，大一新生没有历史成绩很正常）+
   学习能力自评滑块数据，调用 Claude 生成"能力与擅长方向"的诊断。

   和 course-advice.js 结构一致：先查 Redis 缓存，没有就调用 Claude，
   再写回缓存。

   需要的环境变量和 course-advice.js 完全一样，不需要额外配置：
     - ANTHROPIC_API_KEY
     - ANTHROPIC_MODEL（可选）
     - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN（可选，用于缓存）
   ==================================================================== */

const crypto = require('crypto');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const CACHE_TTL_SECONDS = 60 * 60;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '只支持 POST 请求' });
    return;
  }

  if (!ANTHROPIC_API_KEY) {
    res.status(500).json({
      error: '服务器还没配置 ANTHROPIC_API_KEY，请到 Vercel 项目的 Settings → Environment Variables 里添加它，然后重新部署'
    });
    return;
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: '请求体不是合法 JSON' });
    return;
  }

  if (!payload || !Array.isArray(payload.historyCourses) || !payload.abilitySelfRating) {
    res.status(400).json({ error: '数据不完整，至少需要能力自评数据' });
    return;
  }

  const cacheKey =
    'ability-diagnosis:' + crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const cached = await redisGet(cacheKey);
      if (cached) {
        res.status(200).json({ diagnosis: JSON.parse(cached), cached: true });
        return;
      }
    } catch (e) {
      console.warn('Redis 读取失败，跳过缓存：', e.message);
    }
  }

  let diagnosis;
  try {
    diagnosis = await callClaude(payload);
  } catch (e) {
    res.status(502).json({ error: 'AI 生成失败：' + e.message });
    return;
  }

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    redisSet(cacheKey, JSON.stringify(diagnosis), CACHE_TTL_SECONDS).catch(e => {
      console.warn('Redis 写入失败：', e.message);
    });
  }

  res.status(200).json({ diagnosis, cached: false });
};

async function callClaude(payload) {
  const hasHistory = payload.historyCourses.length > 0;

  const systemPrompt = `你是帮大学生做学业规划的助手，现在要基于以下数据做"能力与擅长方向"的诊断：
1. 历史课程成绩（可能是空数组——大一新生还没有历史成绩，这非常正常）
2. 学生可能手动填写的"目前绩点"（manualCurrentGpa，如果有值，代表学生自己从教务系统查到的准确累计绩点，比逐门历史成绩算出来的更权威）
3. 学生对自己五个维度能力的主观自评分数（0-100，仅供参考，不是客观测量）

必须遵守：
1. 这不是一次严格的心理测评或能力鉴定，只是基于有限数据的可解释性观察，语气要谦逊，避免"你就是XX型人才"这种绝对化标签。
2. 如果 manualCurrentGpa 有值，dataNote 里可以直接引用这个数字作为学生当前的整体水平，不需要再去纠结历史成绩数组算出来的平均值是否准确。
3. 如果历史成绩是空数组，明确说明"目前还没有历史成绩，以下判断主要基于你的自我评估，仅供参考"，不要假装从空数据里看出了规律。
4. 如果历史成绩很少（比如少于3门），也要提醒"数据样本较小，随着后续成绩增加判断会更准"。
5. 结合历史成绩里的 tag（数学/编程/写作/实验/语言/人文社科/体育/其他）和对应分数，观察学生在哪类课程上表现相对更好，但不要过度解读单次成绩的波动。
6. 只输出 JSON，不要输出 JSON 之外的任何文字，也不要用 markdown 代码块包裹。

输出的 JSON 结构必须是：
{
  "dataNote": "一句话说明这次诊断基于多少历史数据，数据是否充分",
  "strengths": ["观察到的相对优势方向，每条一句话，1-3条"],
  "watchOuts": ["需要留意或者数据还看不出来的地方，每条一句话，1-2条"],
  "suggestion": "基于以上观察，给一段选课或者学习方式上的具体建议，2-4句话，语气是建议不是命令"
}`;

  const userPrompt = `历史课程成绩（${hasHistory ? payload.historyCourses.length + ' 门' : '暂无，大一新生'}）：
${JSON.stringify(payload.historyCourses, null, 2)}

学习能力自评（0-100分，主观自评）：
${JSON.stringify(payload.abilitySelfRating, null, 2)}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude API 返回 ${resp.status}：${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('没有从模型收到文本内容');

  try {
    return JSON.parse(textBlock.text);
  } catch (e) {
    const match = textBlock.text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('模型返回的内容不是合法 JSON');
  }
}

async function redisGet(key) {
  const resp = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  if (!resp.ok) throw new Error(`Redis GET 返回 ${resp.status}`);
  const data = await resp.json();
  return data.result;
}

async function redisSet(key, value, ttlSeconds) {
  const url = `${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSeconds}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
  if (!resp.ok) throw new Error(`Redis SET 返回 ${resp.status}`);
}

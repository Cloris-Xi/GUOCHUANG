/* ====================================================================
   POST /api/course-advice

   接收学生当前的课程数据 + 目标 + 每周可用时间，调用 Claude 生成
   个性化的选课/学习建议（自然语言判断，不是精确算分）。

   需要在 Vercel 项目的 Environment Variables 里配置：
     - ANTHROPIC_API_KEY        必需，Anthropic 控制台申请的 API Key
     - ANTHROPIC_MODEL          可选，不填默认用 claude-sonnet-5
     - UPSTASH_REDIS_REST_URL   已配置（用于缓存，不配置也能跑，只是不缓存）
     - UPSTASH_REDIS_REST_TOKEN 已配置

   为什么要缓存：同一份课程数据+目标短时间内重复点"生成建议"时，
   不需要每次都重新调用模型，用 Redis 存 1 小时，省钱也更快。
   ==================================================================== */

const crypto = require('crypto');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const CACHE_TTL_SECONDS = 60 * 60; // 1 小时

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

  if (!payload || !Array.isArray(payload.courses) || payload.courses.length === 0) {
    res.status(400).json({ error: '至少需要一门课程的信息才能生成建议' });
    return;
  }
  if (payload.targetGpa == null || payload.finalTargetGpa == null) {
    res.status(400).json({ error: '本学期目标绩点和毕业/最终目标绩点都是必填的' });
    return;
  }

  const cacheKey =
    'gpa-advice:' + crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  // 1. 先查缓存
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const cached = await redisGet(cacheKey);
      if (cached) {
        res.status(200).json({ advice: JSON.parse(cached), cached: true });
        return;
      }
    } catch (e) {
      console.warn('Redis 读取失败，跳过缓存：', e.message);
    }
  }

  // 2. 调用 Claude 生成建议
  let advice;
  try {
    advice = await callClaude(payload);
  } catch (e) {
    res.status(502).json({ error: 'AI 生成失败：' + e.message });
    return;
  }

  // 3. 写入缓存（写失败不影响这次返回结果给用户）
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    redisSet(cacheKey, JSON.stringify(advice), CACHE_TTL_SECONDS).catch(e => {
      console.warn('Redis 写入失败：', e.message);
    });
  }

  res.status(200).json({ advice, cached: false });
};

async function callClaude(payload) {
  const systemPrompt = `你是帮大学生做学业决策的助手。你会收到学生已录入的课程、评分构成、本学期目标绩点、毕业/最终目标绩点、每周可用学习时间，以及可能填写的其他目标要求（比如保研、奖学金、转专业、出国交换等）。
请基于这些信息生成个性化的选课/学习建议，而不是编造具体考试分数。

必须遵守：
1. 不要假装能精确预测考试分数，用"倾向""大概率""值得优先"这类语言，避免绝对化结论。
2. 本学期目标绩点和毕业/最终目标绩点是两个不同的数字，如果两者差距很大（比如毕业目标明显高于本学期目标，或者反过来），要在 summary 里提一句这个差距意味着什么。
3. 如果学生填了"其他目标要求"（保研/奖学金/转专业等），要结合这些要求给建议——比如"转专业"通常需要特定几门课的高分而不是整体绩点，"保研"通常更看重综合绩点排名，这两种取舍是不一样的。
4. 如果课程信息明显不完整，要在 summary 里说明数据不足，不要硬给结论。
5. 只输出 JSON，不要输出 JSON 之外的任何文字，也不要用 markdown 代码块包裹。

输出的 JSON 结构必须是：
{
  "summary": "一段总体判断，2-4句话",
  "options": [
    { "title": "方案名称", "description": "这个方案具体怎么做、适合什么情况，2-3句话" }
  ],
  "risks": ["需要注意的风险点，每条一句话"]
}
options 给 2-4 个方案，risks 给 1-3 条。`;

  const userPrompt = `学生数据：\n${JSON.stringify(payload, null, 2)}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
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
    // 模型偶尔会在 JSON 外面多加几句话，尝试只提取花括号部分再解析一次
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

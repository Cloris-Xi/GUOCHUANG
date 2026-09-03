/* ====================================================================
   POST /api/study-plan

   步骤05「学习方案」的后端。接收本学期课程（含剩余权重、当前加权分等
   前端已经算好的确定性数据）、候选课程与时间冲突、两个目标绩点、每周
   可用时间、优先目标、其他目标要求，调用 Claude 生成三段式结果：

   A. priorityMatrix —— 每门课程/任务在 GPA影响/截止风险/提分潜力/
      时间成本 四个维度上的定性判断，加一个 P0-P3 的建议优先级
   B. achievability —— 目标可达性分析：结合每周时间判断达标概率，
      给出调整目标或增加投入的具体建议
   C. plans —— 稳健方案 / 冲刺方案 / 时间受限方案 / 风险控制方案
      四个固定命名的取舍方案说明

   和 course-advice.js / ability-diagnosis.js 结构一致：先查 Redis
   缓存，没有就调用 Claude，再写回缓存。复用同一组环境变量。
   ==================================================================== */

const crypto = require('crypto');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const CACHE_TTL_SECONDS = 60 * 30;

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
    res.status(400).json({ error: '至少需要一门本学期课程才能生成学习方案' });
    return;
  }
  if (payload.targetGpa == null || payload.finalTargetGpa == null) {
    res.status(400).json({ error: '本学期目标绩点和毕业/最终目标绩点都是必填的' });
    return;
  }

  const cacheKey = 'study-plan:' + crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const cached = await redisGet(cacheKey);
      if (cached) {
        res.status(200).json({ plan: JSON.parse(cached), cached: true });
        return;
      }
    } catch (e) {
      console.warn('Redis 读取失败，跳过缓存：', e.message);
    }
  }

  let plan;
  try {
    plan = await callClaude(payload);
  } catch (e) {
    res.status(502).json({ error: 'AI 生成失败：' + e.message });
    return;
  }

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    redisSet(cacheKey, JSON.stringify(plan), CACHE_TTL_SECONDS).catch(e => {
      console.warn('Redis 写入失败：', e.message);
    });
  }

  res.status(200).json({ plan, cached: false });
};

async function callClaude(payload) {
  const systemPrompt = `你是帮大学生做学业规划的助手，要基于学生的课程数据生成一份三段式的学习方案。

你会收到：本学期课程（每门课的学分、剩余未公布的评分权重、当前已知部分加权算出的分数）、
候选课程清单（已有专业课+想选的选修课，标了必修/选修、上课时间）、系统自动检测出的候选课程
时间冲突、本学期目标绩点、毕业/最终目标绩点、每周可用学习时间、本学期优先目标、是否有实习竞赛、
其他目标要求（保研/奖学金/转专业等）。

必须遵守：
1. 不要编造具体的截止日期或考试时间，你手上没有真实日历数据。"截止风险"这个维度只能基于
   "这门课还有多少评分权重没有公布/考完"来推断——权重占比越大、通常越接近学期末，判定截止
   风险相对越高；缺数据时给"中"，不要假装很确定。
2. "GPA影响"结合学分和剩余权重判断：学分越高、剩余权重越大，对最终GPA的影响通常越大。
3. "提分潜力"结合当前加权分和目标总评的差距判断：已经接近目标或者已经没有剩余权重的课，提分
   潜力低；离目标差距大且还有权重可以争取的课，提分潜力高。
4. "时间成本"是你对这门课/任务通常需要投入多少时间的定性判断，可以参考学分，但不是简单等同学分。
5. 四个维度全部只能是"高"/"中"/"低"三选一，不要用其他词。
6. priority 字段只能是 "P0"、"P1"、"P2"、"P3" 之一：P0 表示最优先，P3 表示有空再做。
7. 目标可达性分析（achievability）：label 只能是"较低"/"中等"/"较高"三选一，narrative 里要
   结合具体的每周可用时间和目标绩点数字说话（比如"若本周可学习时间为20小时，目标学期GPA 3.7
   的可达概率较低"这种句式），suggestions 里可以包含"调整目标数值"或"某门低学分课程不值得
   过度投入"这类具体建议，但不要保证结果，用"倾向""大概率"这类语言。
8. 学习方案（plans）固定给这四个：steady（稳健方案，优先保证不挂科和核心课）、
   sprint（冲刺方案，为奖学金/保研等目标集中投入）、timeLimited（时间受限方案，
   在固定可用时间内最大化GPA）、riskControl（风险控制方案，避免某门高学分课程
   显著拉低GPA）。每个都结合学生的实际数据写2-3句具体的话，不要写成空洞的套话。
9. 如果候选课程有时间冲突（candidateConflicts 不为空），必须在 achievability 的
   narrative 或 suggestions 里提一句，或者在 priorityMatrix 里把冲突课程标出来。
10. 只输出 JSON，不要输出 JSON 之外的任何文字，也不要用 markdown 代码块包裹。

输出的 JSON 结构必须是：
{
  "priorityMatrix": [
    { "name": "课程或任务名称", "gpaImpact": "高|中|低", "deadlineRisk": "高|中|低", "scoreLiftPotential": "高|中|低", "timeCost": "高|中|低", "priority": "P0|P1|P2|P3" }
  ],
  "achievability": {
    "label": "较低|中等|较高",
    "narrative": "1-3句话，结合具体数字",
    "suggestions": ["具体建议，每条一句话，1-3条"]
  },
  "plans": {
    "steady": "稳健方案的具体说明",
    "sprint": "冲刺方案的具体说明",
    "timeLimited": "时间受限方案的具体说明",
    "riskControl": "风险控制方案的具体说明"
  }
}
priorityMatrix 给学生现有的每门本学期课程一行，按 priority 从 P0 到 P3 排序。`;

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
      max_tokens: 1600,
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

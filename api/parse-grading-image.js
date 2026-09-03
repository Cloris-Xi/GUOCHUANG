/* ====================================================================
   POST /api/parse-grading-image

   接收学生上传的一张图片（成绩单截图、课程大纲截图、老师发的评分规则截图
   都可以），用 Claude 的视觉能力识别出里面的评分构成，返回结构化的
   评分项数组，前端直接拿去填充"评分构成"那几行输入框。

   复用和 course-advice.js 一样的 ANTHROPIC_API_KEY，不需要额外配置
   环境变量。

   请求体：{ imageBase64: "data:image/jpeg;base64,...." }
   （前端在上传前已经用 canvas 压缩过，正常不会太大，但这里仍然做了
   大小兜底检查，避免一张几十MB的原图直接怼过来。）
   ==================================================================== */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_BASE64_LENGTH = 6 * 1024 * 1024; // 粗略对应约 4.5MB 原始图片，超过就拒绝

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

  const rawDataUrl = payload && payload.imageBase64;
  if (!rawDataUrl || typeof rawDataUrl !== 'string') {
    res.status(400).json({ error: '没有收到图片数据' });
    return;
  }

  const match = rawDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: '图片格式不对，请重新选择一张 jpg/png 图片' });
    return;
  }
  const mediaType = match[1];
  const base64Data = match[2];

  if (base64Data.length > MAX_BASE64_LENGTH) {
    res.status(400).json({ error: '图片太大了，请截图小一点的范围，或者压缩后再上传' });
    return;
  }

  try {
    const items = await callClaudeVision(mediaType, base64Data);
    res.status(200).json({ items });
  } catch (e) {
    res.status(502).json({ error: 'AI 识别失败：' + e.message });
  }
};

async function callClaudeVision(mediaType, base64Data) {
  const systemPrompt = `你负责从图片里识别大学课程的评分构成（比如"平时作业20% + 期中30% + 期末50%"这种）。
图片可能是课程大纲截图、老师发的通知截图、成绩单截图等。

必须遵守：
1. 只输出一个 JSON 数组，不要输出数组之外的任何文字，也不要用 markdown 代码块包裹。
2. 数组每一项格式为 {"name": "评分项名称", "weight": 数字, "score": 数字或null}。
   如果图片里能看到某一项已经出的具体分数，就填到 score 里；看不到就填 null。
3. weight 填百分比数字（比如 20 代表 20%），不要带 % 符号，不要写成小数。
4. 如果图片里的权重加起来不是 100，也如实按图片内容返回，不要为了凑整而编造或修改数字。
5. 如果这张图片根本看不出任何评分构成信息，返回空数组 []。
6. 名称用图片里出现的原文，不要翻译或改写。`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: '识别这张图片里的评分构成，按要求只返回 JSON 数组。' }
          ]
        }
      ]
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
    const parsed = JSON.parse(textBlock.text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    const arrMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const parsed = JSON.parse(arrMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    }
    throw new Error('模型返回的内容不是合法 JSON 数组');
  }
}

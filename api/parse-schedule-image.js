/* ====================================================================
   POST /api/parse-schedule-image

   接收一张选课系统/课表截图，识别里面的课程：名称、学分、是否必修、
   上课时间。供"个性化选课建议"里的候选课程拖拽导入使用。
   结构和 parse-grading-image.js / parse-transcript-image.js 一样，
   复用同一个 ANTHROPIC_API_KEY。

   请求体：{ imageBase64: "data:image/jpeg;base64,...." }
   返回：{ items: [{name, credit, type, time}] }
   time 字段要求模型输出成 "周二 3-4节；周四 1-2节" 这种格式，
   方便前端 candidates.js 用固定的正则解析冲突。
   ==================================================================== */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_BASE64_LENGTH = 6 * 1024 * 1024;

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
  const systemPrompt = `你负责从图片里识别大学选课系统或课表截图里的课程信息。

必须遵守：
1. 只输出一个 JSON 数组，不要输出数组之外的任何文字，也不要用 markdown 代码块包裹。
2. 数组每一项格式为 {"name": "课程名称", "credit": 数字或null, "type": "必修"或"选修", "time": "上课时间字符串"}。
3. time 字段必须尽量转换成这种固定格式："周二 3-4节；周四 1-2节"（星期用中文"周一"到"周日"，节次用阿拉伯数字加"节"，
   同一门课的多个时间段用中文分号"；"隔开）。如果图片里的时间格式不是"第几节"而是具体时刻（比如"10:00-11:40"），
   就估算成最接近的节次范围；实在无法判断就把 time 留空字符串，不要编造。
4. type 字段：能看出是必修/专业课就填"必修"，选修课/公选课填"选修"，看不出来默认填"选修"。
5. credit 看不到就填 null，不要编造。
6. 如果这张图片根本看不出任何课程信息，返回空数组 []。
7. 课程名称用图片里出现的原文，不要翻译或改写。`;

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
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: '识别这张图片里的课程信息，按要求只返回 JSON 数组。' }
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

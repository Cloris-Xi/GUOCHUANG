/* ====================================================================
   POST /api/parse-transcript-image

   接收一张历史成绩单/成绩查询页面截图，识别出里面的历史课程记录，
   供"历史成绩"模块的拖拽导入使用。和 parse-grading-image.js 结构一样，
   区别只是识别目标不同：那个认的是"评分构成"，这个认的是"已经拿到的
   课程成绩"。

   复用同一个 ANTHROPIC_API_KEY，不需要额外配置环境变量。

   请求体：{ imageBase64: "data:image/jpeg;base64,...." }
   返回：{ items: [{name, credit, score, tag}] }
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
  const systemPrompt = `你负责从图片里识别大学生已经修完的历史课程成绩记录（成绩单、教务系统截图、成绩查询页面截图等）。

必须遵守：
1. 只输出一个 JSON 数组，不要输出数组之外的任何文字，也不要用 markdown 代码块包裹。
2. 数组每一项格式为 {"name": "课程名称", "credit": 数字或null, "score": 数字或null, "tag": "课程类型标签"}。
   - credit 是学分，图片里看不到就填 null，不要编造。
   - score 优先填百分制成绩；如果图片里只有等级（A/B+/优/良等）或绩点，就把原始文本原样放进 score 字段对应的位置也没关系，
     但尽量转换成 0-100 的数字估计值（比如"优"填 90，"良"填 80，"及格"填 62），实在无法判断就填 null。
   - tag 是你根据课程名称大致判断的类型标签，从这几类里选一个最贴近的：数学、编程、写作、实验、语言、人文社科、体育、其他。
     判断不了就填"其他"，不要空着。
3. 如果图片里的某一行明显不是课程成绩（比如表头、总学分统计行），跳过，不要当成一门课。
4. 如果这张图片根本看不出任何课程成绩信息，返回空数组 []。
5. 课程名称用图片里出现的原文，不要翻译或改写。`;

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
            { type: 'text', text: '识别这张图片里的历史课程成绩，按要求只返回 JSON 数组。' }
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

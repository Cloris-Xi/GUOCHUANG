/* ====================================================================
   GET  /api/user-data —— 登录后加载上次保存的全部页面数据
   POST /api/user-data —— 把当前页面数据整个存起来（覆盖式保存）

   存的是前端 js/persistence.js 里 collectAppState() 打包出来的一整
   个 JSON：本学期课程、历史均绩、个人目标、候选课程、能力自评、
   时间与优先目标偏好。不做增量更新，每次保存都是整份覆盖——对于
   这种量级的数据（顶多几十条记录）没必要做得更复杂。

   两个方法都要求已登录（session cookie 校验通过）。
   ==================================================================== */

const { redisGet, redisSet } = require('../lib/redis');
const { getSessionEmail } = require('../lib/auth');

const MAX_BODY_BYTES = 500 * 1024; // 500KB，够存这份数据了，超过大概率是异常输入

module.exports = async (req, res) => {
  let email;
  try {
    email = getSessionEmail(req);
  } catch (e) {
    res.status(500).json({ error: e.message || '校验登录状态失败' });
    return;
  }
  if (!email) {
    res.status(401).json({ error: '请先登录' });
    return;
  }

  const dataKey = `userdata:${email}`;

  if (req.method === 'GET') {
    try {
      const raw = await redisGet(dataKey);
      res.status(200).json({ data: raw ? JSON.parse(raw) : null });
    } catch (e) {
      res.status(500).json({ error: e.message || '读取失败，请稍后重试' });
    }
    return;
  }

  if (req.method === 'POST') {
    let payload;
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      res.status(400).json({ error: '请求体不是合法 JSON' });
      return;
    }

    const serialized = JSON.stringify(payload || {});
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
      res.status(413).json({ error: '要保存的数据太大了，检查一下是不是录入了异常多的课程或候选课程' });
      return;
    }

    try {
      await redisSet(dataKey, serialized);
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message || '保存失败，请稍后重试' });
    }
    return;
  }

  res.status(405).json({ error: '只支持 GET 或 POST 请求' });
};

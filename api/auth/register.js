/* ====================================================================
   POST /api/auth/register

   注册新账号。密码用 bcrypt 哈希后存进 Redis，`user:<email>` 这个
   key 存 {passwordHash, createdAt}，明文密码任何时候都不落地。
   注册成功直接签发 session，相当于自动登录。
   ==================================================================== */

const { redisGet, redisSet } = require('../../lib/redis');
const { hashPassword, setSessionCookie, isValidEmail } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '只支持 POST 请求' });
    return;
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: '请求体不是合法 JSON' });
    return;
  }

  const email = (payload && payload.email || '').trim().toLowerCase();
  const password = payload && payload.password;

  if (!isValidEmail(email)) {
    res.status(400).json({ error: '邮箱格式不对' });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: '密码至少需要 8 位' });
    return;
  }

  const userKey = `user:${email}`;

  try {
    const existing = await redisGet(userKey);
    if (existing) {
      res.status(409).json({ error: '这个邮箱已经注册过了，直接登录，或者用忘记密码找回' });
      return;
    }

    const passwordHash = await hashPassword(password);
    await redisSet(userKey, JSON.stringify({ passwordHash, createdAt: Date.now() }));

    setSessionCookie(res, email);
    res.status(200).json({ email });
  } catch (e) {
    res.status(500).json({ error: e.message || '注册失败，请稍后重试' });
  }
};

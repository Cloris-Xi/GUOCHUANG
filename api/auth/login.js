/* ====================================================================
   POST /api/auth/login
   ==================================================================== */

const { redisGet } = require('../../lib/redis');
const { verifyPassword, setSessionCookie, isValidEmail } = require('../../lib/auth');

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

  if (!isValidEmail(email) || !password) {
    res.status(400).json({ error: '邮箱或密码格式不对' });
    return;
  }

  try {
    const raw = await redisGet(`user:${email}`);
    if (!raw) {
      res.status(401).json({ error: '邮箱或密码不对' });
      return;
    }
    const user = JSON.parse(raw);
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: '邮箱或密码不对' });
      return;
    }

    setSessionCookie(res, email);
    res.status(200).json({ email });
  } catch (e) {
    res.status(500).json({ error: e.message || '登录失败，请稍后重试' });
  }
};

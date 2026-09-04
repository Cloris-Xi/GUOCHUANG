/* ====================================================================
   POST /api/auth/reset-password

   用邮件里的 token 换新密码。token 一次性：用完（或过期）就从 Redis
   删掉，防止链接被重复使用。
   ==================================================================== */

const { redisGet, redisSet, redisDel } = require('../../lib/redis');
const { hashPassword } = require('../../lib/auth');

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

  const token = payload && payload.token;
  const newPassword = payload && payload.newPassword;

  if (!token) {
    res.status(400).json({ error: '缺少重置令牌' });
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: '新密码至少需要 8 位' });
    return;
  }

  try {
    const email = await redisGet(`reset:${token}`);
    if (!email) {
      res.status(400).json({ error: '重置链接已失效或已经用过，请重新申请一次' });
      return;
    }

    const userKey = `user:${email}`;
    const raw = await redisGet(userKey);
    const user = raw ? JSON.parse(raw) : { createdAt: Date.now() };
    user.passwordHash = await hashPassword(newPassword);
    await redisSet(userKey, JSON.stringify(user));

    await redisDel(`reset:${token}`);

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '重置失败，请稍后重试' });
  }
};

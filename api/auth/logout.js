/* ====================================================================
   POST /api/auth/logout —— 清空 session cookie，不需要动 Redis。
   ==================================================================== */

const { clearSessionCookie } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: '只支持 POST 请求' });
    return;
  }
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
};

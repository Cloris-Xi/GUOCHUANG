/* ====================================================================
   GET /api/auth/me —— 前端页面加载时用来判断"当前有没有登录"。
   ==================================================================== */

const { getSessionEmail } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: '只支持 GET 请求' });
    return;
  }

  let email;
  try {
    email = getSessionEmail(req);
  } catch (e) {
    res.status(500).json({ error: e.message || '校验登录状态失败' });
    return;
  }

  if (!email) {
    res.status(200).json({ loggedIn: false });
    return;
  }
  res.status(200).json({ loggedIn: true, email });
};

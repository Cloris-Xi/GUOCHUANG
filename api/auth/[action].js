/* ====================================================================
   /api/auth/[action].js —— 动态路由，一个文件顶原来的 6 个：
   /api/auth/register、login、logout、me、forgot-password、reset-password
   全部落到这一个 Serverless Function 上，靠 req.query.action 分发。

   合并的原因：Vercel Hobby（免费）计划每次部署最多 12 个 Serverless
   Function，这个项目 api/ 下的接口本来就有 7 个，auth 那边原来单独
   6 个文件会导致总数 13 个超限，部署会在"Deploying outputs"阶段
   失败（而不是在 build 阶段报错，容易让人摸不着头脑）。合并成一个
   动态路由后总数降到 8 个，前端请求的 URL 完全不用改。
   ==================================================================== */

const crypto = require('crypto');
const { redisGet, redisSet, redisDel } = require('../../lib/redis');
const {
  hashPassword, verifyPassword, setSessionCookie, clearSessionCookie,
  getSessionEmail, isValidEmail
} = require('../../lib/auth');
const { sendResetPasswordEmail } = require('../../lib/email');

const RESET_TOKEN_TTL_SECONDS = 30 * 60;

module.exports = async (req, res) => {
  const action = req.query.action;

  try {
    if (action === 'register') return await handleRegister(req, res);
    if (action === 'login') return await handleLogin(req, res);
    if (action === 'logout') return await handleLogout(req, res);
    if (action === 'me') return await handleMe(req, res);
    if (action === 'forgot-password') return await handleForgotPassword(req, res);
    if (action === 'reset-password') return await handleResetPassword(req, res);
    res.status(404).json({ error: '没有这个接口' });
  } catch (e) {
    res.status(500).json({ error: e.message || '服务器出错，请稍后重试' });
  }
};

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

/* ---------------- register ---------------- */
async function handleRegister(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: '只支持 POST 请求' }); return; }

  let payload;
  try { payload = parseBody(req); } catch (e) { res.status(400).json({ error: '请求体不是合法 JSON' }); return; }

  const email = (payload && payload.email || '').trim().toLowerCase();
  const password = payload && payload.password;

  if (!isValidEmail(email)) { res.status(400).json({ error: '邮箱格式不对' }); return; }
  if (!password || password.length < 8) { res.status(400).json({ error: '密码至少需要 8 位' }); return; }

  const userKey = `user:${email}`;
  const existing = await redisGet(userKey);
  if (existing) { res.status(409).json({ error: '这个邮箱已经注册过了，直接登录，或者用忘记密码找回' }); return; }

  const passwordHash = await hashPassword(password);
  await redisSet(userKey, JSON.stringify({ passwordHash, createdAt: Date.now() }));

  setSessionCookie(res, email);
  res.status(200).json({ email });
}

/* ---------------- login ---------------- */
async function handleLogin(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: '只支持 POST 请求' }); return; }

  let payload;
  try { payload = parseBody(req); } catch (e) { res.status(400).json({ error: '请求体不是合法 JSON' }); return; }

  const email = (payload && payload.email || '').trim().toLowerCase();
  const password = payload && payload.password;

  if (!isValidEmail(email) || !password) { res.status(400).json({ error: '邮箱或密码格式不对' }); return; }

  const raw = await redisGet(`user:${email}`);
  if (!raw) { res.status(401).json({ error: '邮箱或密码不对' }); return; }

  const user = JSON.parse(raw);
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: '邮箱或密码不对' }); return; }

  setSessionCookie(res, email);
  res.status(200).json({ email });
}

/* ---------------- logout ---------------- */
async function handleLogout(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: '只支持 POST 请求' }); return; }
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

/* ---------------- me ---------------- */
async function handleMe(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: '只支持 GET 请求' }); return; }
  const email = getSessionEmail(req);
  if (!email) { res.status(200).json({ loggedIn: false }); return; }
  res.status(200).json({ loggedIn: true, email });
}

/* ---------------- forgot-password ---------------- */
async function handleForgotPassword(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: '只支持 POST 请求' }); return; }

  let payload;
  try { payload = parseBody(req); } catch (e) { res.status(400).json({ error: '请求体不是合法 JSON' }); return; }

  const email = (payload && payload.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) { res.status(400).json({ error: '邮箱格式不对' }); return; }

  const genericMessage = '如果这个邮箱已经注册过，重置链接已经发过去了，请去邮箱查收（包括垃圾邮件夹）。';

  const existing = await redisGet(`user:${email}`);
  if (existing) {
    const token = crypto.randomBytes(32).toString('hex');
    await redisSet(`reset:${token}`, email, RESET_TOKEN_TTL_SECONDS);

    const protocol = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = req.headers.host;
    const resetUrl = `${protocol}://${host}/?reset=${token}`;

    await sendResetPasswordEmail(email, resetUrl);
  }
  res.status(200).json({ message: genericMessage });
}

/* ---------------- reset-password ---------------- */
async function handleResetPassword(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: '只支持 POST 请求' }); return; }

  let payload;
  try { payload = parseBody(req); } catch (e) { res.status(400).json({ error: '请求体不是合法 JSON' }); return; }

  const token = payload && payload.token;
  const newPassword = payload && payload.newPassword;

  if (!token) { res.status(400).json({ error: '缺少重置令牌' }); return; }
  if (!newPassword || newPassword.length < 8) { res.status(400).json({ error: '新密码至少需要 8 位' }); return; }

  const email = await redisGet(`reset:${token}`);
  if (!email) { res.status(400).json({ error: '重置链接已失效或已经用过，请重新申请一次' }); return; }

  const userKey = `user:${email}`;
  const raw = await redisGet(userKey);
  const user = raw ? JSON.parse(raw) : { createdAt: Date.now() };
  user.passwordHash = await hashPassword(newPassword);
  await redisSet(userKey, JSON.stringify(user));

  await redisDel(`reset:${token}`);
  res.status(200).json({ ok: true });
}

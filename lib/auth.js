/* ====================================================================
   lib/auth.js —— 登录功能的共享工具：
     - 密码哈希/校验（bcryptjs）
     - session 令牌的签发/校验（HMAC 签名的 cookie，不用数据库存 session）
     - cookie 的读取/写入（Vercel 的 Node 运行时不自带 cookie 解析）

   session 的设计：cookie 里存 base64(JSON({email, exp})) + "." + HMAC签名，
   服务器不需要为每个 session 单独存一条记录，校验的时候重新算一遍签名
   对比就行，减少一次 Redis 读。登出就是把 cookie 清空。

   需要环境变量：SESSION_SECRET（随便一串够长的随机字符串，用来签名，
   泄露了等于所有人的登录状态都能被伪造，务必只放在 Vercel 环境变量里）。
   ==================================================================== */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天
const COOKIE_NAME = 'gpa_session';

function assertSecretConfigured() {
  if (!SESSION_SECRET) {
    throw new Error('服务器还没配置 SESSION_SECRET，请到 Vercel 项目的 Settings → Environment Variables 里添加它（随便一串足够长的随机字符串），然后重新部署');
  }
}

/* ---------------- 密码哈希 ---------------- */
async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/* ---------------- session 令牌 ---------------- */
function signSession(email) {
  assertSecretConfigured();
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_SECONDS * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySession(token) {
  assertSecretConfigured();
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!data.email || !data.exp || Date.now() > data.exp) return null;
  return data.email;
}

/* ---------------- cookie 读写 ---------------- */
function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function setSessionCookie(res, email) {
  const token = signSession(email);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

/* 从请求里取出当前登录的邮箱，没登录或 session 无效返回 null */
function getSessionEmail(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

/* 邮箱格式做个最基本的校验，不用正则死磕 RFC，够用就行 */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  getSessionEmail,
  isValidEmail
};

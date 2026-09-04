/* ====================================================================
   lib/redis.js —— Upstash Redis REST API 的最小封装，供 api/ 下所有
   需要读写用户数据/会话/重置令牌的接口共用。

   放在 lib/ 而不是 api/ 目录下，是因为 Vercel 会把 api/ 下每个 .js
   文件都当成一个 HTTP 路由，lib/ 不会，可以放心当普通模块 require。

   需要环境变量：UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
   （项目里已经配置过，登录功能复用同一份，不需要新开一个 Redis）。
   ==================================================================== */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function assertConfigured() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error('服务器还没配置 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN，登录功能需要 Redis 存账号数据');
  }
}

async function redisGet(key) {
  assertConfigured();
  const resp = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  if (!resp.ok) throw new Error(`Redis GET 返回 ${resp.status}`);
  const data = await resp.json();
  return data.result; // 字符串或 null
}

async function redisSet(key, value, ttlSeconds) {
  assertConfigured();
  const url = ttlSeconds
    ? `${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSeconds}`
    : `${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
  if (!resp.ok) throw new Error(`Redis SET 返回 ${resp.status}`);
}

async function redisDel(key) {
  assertConfigured();
  const resp = await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  if (!resp.ok) throw new Error(`Redis DEL 返回 ${resp.status}`);
}

module.exports = { redisGet, redisSet, redisDel };

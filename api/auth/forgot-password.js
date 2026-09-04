/* ====================================================================
   POST /api/auth/forgot-password

   生成一个一次性重置令牌存进 Redis（30分钟过期），通过 Resend 发一封
   带重置链接的邮件。出于安全考虑，不管这个邮箱有没有注册过，都返回
   同样的成功提示——不然别人可以拿这个接口去试探哪些邮箱注册过。
   ==================================================================== */

const crypto = require('crypto');
const { redisGet, redisSet } = require('../../lib/redis');
const { isValidEmail } = require('../../lib/auth');
const { sendResetPasswordEmail } = require('../../lib/email');

const RESET_TOKEN_TTL_SECONDS = 30 * 60;

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
  if (!isValidEmail(email)) {
    res.status(400).json({ error: '邮箱格式不对' });
    return;
  }

  // 统一返回这句话，不暴露邮箱是否存在
  const genericMessage = '如果这个邮箱已经注册过，重置链接已经发过去了，请去邮箱查收（包括垃圾邮件夹）。';

  try {
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
  } catch (e) {
    // 邮件服务本身的配置错误（比如没配 RESEND_API_KEY）要让开发者能看到，
    // 不能也隐藏成"发送成功"，不然调试的时候无从下手。
    res.status(500).json({ error: e.message || '发送失败，请稍后重试' });
  }
};

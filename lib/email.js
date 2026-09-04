/* ====================================================================
   lib/email.js —— 用 Resend 发"忘记密码"邮件的最小封装。

   需要环境变量：
     - RESEND_API_KEY   必需，去 https://resend.com 注册后在控制台申请
     - RESEND_FROM       可选，发件地址；不填默认用 Resend 提供的测试
                         发件地址 onboarding@resend.dev（不需要自己验证
                         域名就能用，但邮件里会带 Resend 的水印提示，
                         正式上线建议在 Resend 后台验证自己的域名后
                         把这个改成自己的邮箱，比如 no-reply@yourdomain.com）
   ==================================================================== */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';

async function sendResetPasswordEmail(toEmail, resetUrl) {
  if (!RESEND_API_KEY) {
    throw new Error('服务器还没配置 RESEND_API_KEY，请到 Vercel 项目的 Settings → Environment Variables 里添加它，然后重新部署');
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: toEmail,
      subject: '重置你的学业罗盘密码',
      html: `
        <p>你好，</p>
        <p>我们收到了重置你「学业罗盘」账号密码的请求。点击下面的链接设置新密码，链接 30 分钟内有效：</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>如果这不是你本人的操作，忽略这封邮件即可，密码不会被修改。</p>
      `
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Resend 返回 ${resp.status}：${text.slice(0, 200)}`);
  }
}

module.exports = { sendResetPasswordEmail };

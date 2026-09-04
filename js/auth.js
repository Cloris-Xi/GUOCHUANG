/* ---------------- 登录 / 注册 / 忘记密码 / 重置密码（前端） ----------------
   currentUserEmail：全局状态，null 表示未登录。
   页面加载时先调 /api/auth/me 确认登录状态；如果 URL 里带 ?reset=<token>，
   优先弹出"设置新密码"表单（不管有没有登录，因为重置密码本来就是给
   "登录不了"的人用的）。 */

let currentUserEmail = null;

function openAuthModal(view){
  document.getElementById('authModal').style.display = 'flex';
  renderAuthModal(view);
}
function closeAuthModal(){
  document.getElementById('authModal').style.display = 'none';
}
document.getElementById('authModalClose').onclick = closeAuthModal;
document.getElementById('authModal').addEventListener('click', e=>{
  if(e.target.id === 'authModal') closeAuthModal();
});

function renderAuthBar(){
  const status = document.getElementById('authStatus');
  const actions = document.getElementById('authActions');
  if(currentUserEmail){
    status.innerHTML = `已登录：<b>${escapeHtml(currentUserEmail)}</b>`;
    actions.innerHTML = `
      <button class="btn ghost" id="saveDataBtn">保存我的数据</button>
      <button class="btn ghost" id="logoutBtn">退出登录</button>`;
    document.getElementById('saveDataBtn').onclick = handleSaveData;
    document.getElementById('logoutBtn').onclick = handleLogout;
  } else {
    status.textContent = '登录后可以保存数据，下次回来接着填';
    actions.innerHTML = `
      <button class="btn ghost" id="openLoginBtn">登录</button>
      <button class="btn" style="background:var(--profile);" id="openRegisterBtn">注册</button>`;
    document.getElementById('openLoginBtn').onclick = ()=> openAuthModal('login');
    document.getElementById('openRegisterBtn').onclick = ()=> openAuthModal('register');
  }
}

async function handleSaveData(){
  const btn = document.getElementById('saveDataBtn');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = '保存中…';
  try {
    await saveUserData();
    btn.textContent = '已保存 ✓';
  } catch(err){
    btn.textContent = original;
    alert(err.message || '保存失败，请稍后重试');
  } finally {
    setTimeout(()=>{ btn.disabled=false; btn.textContent=original; }, 1500);
  }
}

async function handleLogout(){
  await fetch('/api/auth/logout', { method:'POST' });
  currentUserEmail = null;
  renderAuthBar();
}

/* ---------------- 弹窗内容渲染 ---------------- */
function renderAuthModal(view, opts={}){
  const body = document.getElementById('authModalBody');

  if(view === 'login'){
    body.innerHTML = `
      <h3>登录</h3>
      <div class="field"><label>邮箱</label><input type="email" id="loginEmail"></div>
      <div class="field"><label>密码</label><input type="password" id="loginPassword"></div>
      <div class="btn-row"><button class="btn" style="background:var(--profile);" id="loginSubmitBtn">登录</button></div>
      <div id="authModalMsg"></div>
      <p style="margin-top:14px; font-size:13px;">
        <button class="switch-link" id="toRegisterBtn">还没有账号？去注册</button>
      </p>
      <p style="font-size:13px;"><button class="switch-link" id="toForgotBtn">忘记密码了</button></p>
    `;
    document.getElementById('loginSubmitBtn').onclick = async ()=>{
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      await submitAuthForm('/api/auth/login', { email, password }, '登录中…');
    };
    document.getElementById('toRegisterBtn').onclick = ()=> renderAuthModal('register');
    document.getElementById('toForgotBtn').onclick = ()=> renderAuthModal('forgot');

  } else if(view === 'register'){
    body.innerHTML = `
      <h3>注册</h3>
      <div class="field"><label>邮箱</label><input type="email" id="registerEmail"></div>
      <div class="field"><label>密码（至少 8 位）</label><input type="password" id="registerPassword"></div>
      <div class="btn-row"><button class="btn" style="background:var(--profile);" id="registerSubmitBtn">注册</button></div>
      <div id="authModalMsg"></div>
      <p style="margin-top:14px; font-size:13px;">
        <button class="switch-link" id="toLoginBtn">已经有账号？去登录</button>
      </p>
    `;
    document.getElementById('registerSubmitBtn').onclick = async ()=>{
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      await submitAuthForm('/api/auth/register', { email, password }, '注册中…');
    };
    document.getElementById('toLoginBtn').onclick = ()=> renderAuthModal('login');

  } else if(view === 'forgot'){
    body.innerHTML = `
      <h3>忘记密码</h3>
      <p style="font-size:13px; color:var(--ink-soft); margin-top:0;">输入注册时用的邮箱，我们会发一封带重置链接的邮件过去。</p>
      <div class="field"><label>邮箱</label><input type="email" id="forgotEmail"></div>
      <div class="btn-row"><button class="btn" style="background:var(--profile);" id="forgotSubmitBtn">发送重置邮件</button></div>
      <div id="authModalMsg"></div>
      <p style="margin-top:14px; font-size:13px;"><button class="switch-link" id="toLoginBtn2">想起来了？去登录</button></p>
    `;
    document.getElementById('forgotSubmitBtn').onclick = async ()=>{
      const btn = document.getElementById('forgotSubmitBtn');
      const email = document.getElementById('forgotEmail').value.trim();
      const msgBox = document.getElementById('authModalMsg');
      btn.disabled = true;
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email})
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || '发送失败');
        msgBox.innerHTML = `<div class="modal-msg ok">${escapeHtml(data.message)}</div>`;
      } catch(err){
        msgBox.innerHTML = `<div class="modal-msg error">${escapeHtml(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    };
    document.getElementById('toLoginBtn2').onclick = ()=> renderAuthModal('login');

  } else if(view === 'reset'){
    body.innerHTML = `
      <h3>设置新密码</h3>
      <div class="field"><label>新密码（至少 8 位）</label><input type="password" id="resetPassword"></div>
      <div class="btn-row"><button class="btn" style="background:var(--profile);" id="resetSubmitBtn">确认修改</button></div>
      <div id="authModalMsg"></div>
    `;
    document.getElementById('resetSubmitBtn').onclick = async ()=>{
      const btn = document.getElementById('resetSubmitBtn');
      const newPassword = document.getElementById('resetPassword').value;
      const msgBox = document.getElementById('authModalMsg');
      btn.disabled = true;
      try {
        const res = await fetch('/api/auth/reset-password', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ token: opts.token, newPassword })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || '重置失败');
        msgBox.innerHTML = `<div class="modal-msg ok">密码修改成功，去登录吧。</div>`;
        setTimeout(()=> renderAuthModal('login'), 1200);
      } catch(err){
        msgBox.innerHTML = `<div class="modal-msg error">${escapeHtml(err.message)}</div>`;
        btn.disabled = false;
      }
    };
  }
}

async function submitAuthForm(url, payload, loadingText){
  const btn = document.querySelector('#authModalBody .btn:not(.ghost)');
  const msgBox = document.getElementById('authModalMsg');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = loadingText;
  try {
    const res = await fetch(url, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || '操作失败');
    currentUserEmail = data.email;
    closeAuthModal();
    renderAuthBar();
    try { await loadUserData(); } catch(e){ /* 加载失败不影响登录本身 */ }
  } catch(err){
    msgBox.innerHTML = `<div class="modal-msg error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
}

/* ---------------- 初始化：检查登录状态 + 处理重置密码链接 ---------------- */
(async function initAuth(){
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset');

  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if(data.loggedIn){
      currentUserEmail = data.email;
      try { await loadUserData(); } catch(e){ /* 静默失败，不影响页面正常使用 */ }
    }
  } catch(e){
    /* 接口本身失败（比如还没配置 SESSION_SECRET）不影响页面其它功能正常使用 */
  }
  renderAuthBar();

  if(resetToken){
    openAuthModal('reset', { token: resetToken });
    // 清掉地址栏里的 token，避免刷新或分享链接时暴露/重复使用
    urlParams.delete('reset');
    const newUrl = window.location.pathname + (urlParams.toString() ? '?'+urlParams.toString() : '');
    window.history.replaceState({}, '', newUrl);
  }
})();

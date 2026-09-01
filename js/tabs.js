/* ---------------- Tabs ---------------- */
const tabColors = {profile:"var(--profile)", sim:"var(--sim)", plan:"var(--plan)", matrix:"var(--matrix)", ability:"var(--ability)"};
document.getElementById('tabs').addEventListener('click', e=>{
  const btn = e.target.closest('.tab');
  if(!btn) return;
  document.querySelectorAll('.tab').forEach(t=>{t.classList.remove('active'); t.style.background='var(--card)'; t.style.color=getComputedStyle(document.documentElement).getPropertyValue('--ink-soft');});
  const key = btn.dataset.tab;
  btn.classList.add('active');
  btn.style.background = tabColors[key];
  btn.style.color = '#fff';
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+key).classList.add('active');
  if(key==='sim') renderSimSelect();
  if(key==='matrix') renderMatrix();
});
// init default tab color
document.querySelector('.tab.active').style.background = 'var(--profile)';
document.querySelector('.tab.active').style.color = '#fff';

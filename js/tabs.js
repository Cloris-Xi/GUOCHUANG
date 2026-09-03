/* ---------------- 快速跳转导航 ----------------
   页面现在是竖排单页（不再是切换式 Tab），这里的按钮只负责：
   1. 点击时平滑滚动到对应区块
   2. 根据当前滚动到了哪个区块，高亮对应按钮
   之前那套"隐藏其它 panel、只显示一个"的逻辑已经不需要了。 */

document.getElementById('tabs').addEventListener('click', e=>{
  const btn = e.target.closest('.tab');
  if(!btn) return;
  const target = document.getElementById(btn.dataset.target);
  if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
});

function setActiveTab(targetId){
  document.querySelectorAll('.tab').forEach(t=>{
    const active = t.dataset.target === targetId;
    t.classList.toggle('active', active);
    t.style.background = active ? t.dataset.color : 'var(--card)';
    t.style.color = active ? '#fff' : t.dataset.color;
  });
}

const jumpTargets = [...document.querySelectorAll('.tab')]
  .map(t => document.getElementById(t.dataset.target))
  .filter(Boolean);

if('IntersectionObserver' in window && jumpTargets.length){
  const observer = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting) setActiveTab(entry.target.id);
    });
  }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
  jumpTargets.forEach(el => observer.observe(el));
} else if(jumpTargets[0]){
  setActiveTab(jumpTargets[0].id);
}

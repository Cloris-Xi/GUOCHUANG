/* ---------------- Module 5: Ability ---------------- */
const abilityDims = [
  {key:'exam', label:'考试型能力（闭卷 / 计算 / 记忆）', color:'var(--profile)'},
  {key:'project', label:'项目型能力（编程 / 实验 / 作品）', color:'var(--sim)'},
  {key:'process', label:'过程型能力（出勤 / 作业稳定性）', color:'var(--plan)'},
  {key:'collab', label:'协作型能力（小组项目 / 展示沟通）', color:'var(--matrix)'},
  {key:'time', label:'时间管理（是否临近截止才完成）', color:'var(--ability)'},
];
function renderAbility(){
  const wrap = document.getElementById('abilitySliders');
  wrap.innerHTML = abilityDims.map(d=>`
    <div class="slider-row">
      <div class="top"><span class="name">${d.label}</span><span id="aval-${d.key}">60</span></div>
      <input type="range" min="0" max="100" value="60" data-dim="${d.key}" style="accent-color:${d.color};">
      <div class="bar-track" style="margin-top:8px;"><div class="bar-fill" id="abar-${d.key}" style="width:60%; background:${d.color};"></div></div>
    </div>
  `).join('');
  wrap.querySelectorAll('input[type=range]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      document.getElementById('aval-'+inp.dataset.dim).textContent = inp.value;
      document.getElementById('abar-'+inp.dataset.dim).style.width = inp.value+'%';
    });
  });
}
renderAbility();

/* ---------------- Module 3: Plan cards ---------------- */
const planDefs = [
  {key:'gpa', title:'GPA 稳健型', color:'var(--profile)', bg:'var(--profile-soft)',
    tags:['优先保证核心课不失手','均衡分配时间'],
    metrics:[['预计学期GPA区间','3.5 – 3.7'],['每周学习时间','22 – 26 小时'],['冲突风险','低']]},
  {key:'ability', title:'专业能力优先型', color:'var(--matrix)', bg:'var(--matrix-soft)',
    tags:['集中投入项目型课程','兼顾扎实的过程分'],
    metrics:[['预计学期GPA区间','3.3 – 3.6'],['每周学习时间','26 – 30 小时'],['冲突风险','中']]},
  {key:'baoyan', title:'保研资格优先型', color:'var(--ability)', bg:'var(--ability-soft)',
    tags:['冲刺高权重必修课','为绩点上限留出空间'],
    metrics:[['预计学期GPA区间','3.6 – 3.9'],['每周学习时间','30+ 小时'],['冲突风险','中高']]},
  {key:'balance', title:'控制每周学习时间型', color:'var(--plan)', bg:'var(--plan-soft)',
    tags:['优先低学分高效率课程','为实习/竞赛预留时间'],
    metrics:[['预计学期GPA区间','3.2 – 3.5'],['每周学习时间','18 – 22 小时'],['冲突风险','低']]},
];
function renderPlanCards(matchKey){
  const wrap = document.getElementById('planCards');
  wrap.innerHTML = planDefs.map(p=>`
    <div class="plan-card ${p.key===matchKey?'match':''}">
      <h3 style="color:${p.color}">${p.title}</h3>
      <div class="plan-tags">${p.tags.map(t=>`<span>${t}</span>`).join('')}</div>
      ${p.metrics.map(m=>`<div class="plan-metric"><span>${m[0]}</span><b>${m[1]}</b></div>`).join('')}
    </div>
  `).join('');
}
renderPlanCards(null);
document.getElementById('matchPlanBtn').onclick = ()=>{
  const hours = parseFloat(document.getElementById('weeklyHours').value);
  const goal = document.getElementById('priorityGoal').value;
  let matchKey = goal;
  if(!isNaN(hours) && hours < 20) matchKey = 'balance';
  renderPlanCards(matchKey);
};

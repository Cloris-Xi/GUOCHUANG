/* ---------------- 模块05：学习方案（AI 生成） ----------------
   A. 优先级矩阵：课程/任务 × GPA影响/截止风险/提分潜力/时间成本 → 建议优先级(P0-P3)
   B. 目标可达性分析：结合每周可用时间和两个目标绩点，判断达标概率、给调整建议
   C. 学习方案：稳健/冲刺/时间受限/风险控制 四种固定命名的取舍方案

   这三块都需要综合判断（不是单纯算术），所以交给 AI 生成，前端只负责
   把"绩点档案+成绩模拟计算器+个性化选课建议"里已经收集到的结构化数据
   打包发过去，以及把结果渲染出来。 */

const PRIORITY_STYLE = {
  P0: { bg:'#FDEAEA', color:'#B3261E', label:'P0 · 最优先' },
  P1: { bg:'var(--plan-soft)', color:'var(--plan)', label:'P1 · 尽快安排' },
  P2: { bg:'var(--matrix-soft)', color:'var(--matrix)', label:'P2 · 常规推进' },
  P3: { bg:'var(--sim-soft)', color:'var(--sim)', label:'P3 · 有空再做' }
};

document.getElementById('generatePlanBtn').onclick = async ()=>{
  const btn = document.getElementById('generatePlanBtn');
  const resultBox = document.getElementById('studyPlanResult');
  const emptyBox = document.getElementById('studyPlanEmpty');

  if(!courses.length){
    emptyBox.style.display = 'block';
    resultBox.style.display = 'none';
    return;
  }

  const targetGpa = parseFloat(document.getElementById('targetGpa').value);
  const finalTargetGpa = parseFloat(document.getElementById('finalTargetGpa').value);
  emptyBox.style.display = 'none';
  resultBox.style.display = 'block';

  if(isNaN(targetGpa) || isNaN(finalTargetGpa)){
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>先填两个必填的目标绩点</b>回到"绩点档案 → 个人目标"，把"本学期目标绩点"和"毕业/最终目标绩点"都填上，生成学习方案需要这两个数字。</div></div>`;
    return;
  }
  if(!isCurrentGpaProvided()){
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>先填"目前绩点"</b>回到"绩点档案 → 历史均绩"，填一下目前绩点，如果你是大一新生还没有绩点，勾选那个选项就行。</div></div>`;
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'AI 正在生成…';
  resultBox.innerHTML = `<div class="empty">AI 正在根据你的课程、候选课程和目标生成学习方案，通常需要十几秒…</div>`;

  const otherGoals = [...document.querySelectorAll('.goal-check:checked')].map(c=>c.value);
  const otherGoalsText = document.getElementById('otherGoalsText').value.trim();
  const candidateCourses = typeof getCandidateCoursesFromDOM === 'function' ? getCandidateCoursesFromDOM() : [];
  const candidateConflicts = typeof findConflicts === 'function'
    ? findConflicts(candidateCourses).map(c=>({
        courseA: c.a, courseB: c.b, day: WEEKDAY_LABEL[c.day],
        slotA: `${c.aSlot.start}-${c.aSlot.end}节`, slotB: `${c.bSlot.start}-${c.bSlot.end}节`
      }))
    : [];

  const payload = {
    courses: courses.map(c=>{
      const { known, knownWeight, remaining } = courseKnownTotal(c);
      return {
        name: c.name,
        credit: c.credit,
        target: c.target,
        knownWeightCompleted: knownWeight,
        remainingWeight: remaining,
        currentWeightedScore: known
      };
    }),
    candidateCourses,
    candidateConflicts,
    targetGpa,
    finalTargetGpa,
    manualCurrentGpa: document.getElementById('manualCurrentGpa').value || null,
    gpaScale: document.getElementById('gpaScale').value,
    weeklyHours: (()=>{ const h = parseFloat(document.getElementById('weeklyHours').value); return isNaN(h) ? null : h; })(),
    priorityGoal: document.getElementById('priorityGoal').value,
    hasOutside: document.getElementById('hasOutside').value,
    otherGoals,
    otherGoalsText: otherGoalsText || null
  };

  try {
    const plan = await getStudyPlan(payload);
    renderStudyPlan(plan);
  } catch (err) {
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>生成失败</b>${escapeHtml(err.message || '请稍后重试')}</div></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

function renderStudyPlan(plan){
  const resultBox = document.getElementById('studyPlanResult');
  if(!plan){
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>没有收到有效结果</b>请重试一次。</div></div>`;
    return;
  }

  let html = '';

  /* A. 优先级矩阵 */
  html += `<div class="card" style="margin-bottom:16px;">
    <div class="sub-heading"><span class="n" style="background:var(--matrix-soft); color:var(--matrix);">A</span>优先级矩阵</div>
    <table>
      <thead><tr><th>课程/任务</th><th>GPA影响</th><th>截止风险</th><th>提分潜力</th><th>时间成本</th><th>建议优先级</th></tr></thead>
      <tbody>`;
  (plan.priorityMatrix || []).forEach(row=>{
    const p = PRIORITY_STYLE[row.priority] || PRIORITY_STYLE.P2;
    html += `<tr>
      <td>${escapeHtml(row.name || '')}</td>
      <td>${escapeHtml(row.gpaImpact || '—')}</td>
      <td>${escapeHtml(row.deadlineRisk || '—')}</td>
      <td>${escapeHtml(row.scoreLiftPotential || '—')}</td>
      <td>${escapeHtml(row.timeCost || '—')}</td>
      <td><span class="pill" style="background:${p.bg}; color:${p.color};">${escapeHtml(row.priority || 'P2')}</span></td>
    </tr>`;
  });
  html += `</tbody></table></div>`;

  /* B. 目标可达性分析 */
  if(plan.achievability){
    const a = plan.achievability;
    html += `<div class="card" style="margin-bottom:16px;">
      <div class="sub-heading"><span class="n" style="background:var(--matrix-soft); color:var(--matrix);">B</span>目标可达性分析${a.label ? `<span class="flow-tag input" style="margin-left:8px;">可达概率：${escapeHtml(a.label)}</span>` : ''}</div>
      <p style="font-size:14px; margin:0 0 10px;">${escapeHtml(a.narrative || '')}</p>`;
    if(Array.isArray(a.suggestions) && a.suggestions.length){
      html += `<ul style="margin:0; padding-left:20px; font-size:14px;">${a.suggestions.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
    }
    html += `</div>`;
  }

  /* C. 学习方案（四个固定命名） */
  if(plan.plans){
    const planLabels = [
      { key:'steady', title:'稳健方案', color:'var(--sim)', bg:'var(--sim-soft)' },
      { key:'sprint', title:'冲刺方案', color:'var(--ability)', bg:'var(--ability-soft)' },
      { key:'timeLimited', title:'时间受限方案', color:'var(--plan)', bg:'var(--plan-soft)' },
      { key:'riskControl', title:'风险控制方案', color:'var(--profile)', bg:'var(--profile-soft)' }
    ];
    html += `<div class="card">
      <div class="sub-heading"><span class="n" style="background:var(--matrix-soft); color:var(--matrix);">C</span>学习方案</div>
      <div class="grid cols-2">`;
    planLabels.forEach(p=>{
      const desc = plan.plans[p.key];
      if(!desc) return;
      html += `<div class="plan-card">
        <h3 style="color:${p.color};">${p.title}</h3>
        <p style="font-size:13.5px; margin:8px 0 0; color:var(--ink);">${escapeHtml(desc)}</p>
      </div>`;
    });
    html += `</div></div>`;
  }

  resultBox.innerHTML = html;
}

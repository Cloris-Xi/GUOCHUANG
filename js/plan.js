/* ---------------- Module 3: 选课方案 ---------------- */

/* 四张参考卡片：只是给学生一个直观的策略光谱，不代表 AI 的最终判断。
   AI 会结合学生实际录入的课程和目标，生成下面 aiAdviceResult 里的内容。 */
const planDefs = [
  {title:'GPA 稳健型', color:'var(--profile)',
    tags:['优先保证核心课不失手','均衡分配时间']},
  {title:'专业能力优先型', color:'var(--matrix)',
    tags:['集中投入项目型课程','兼顾扎实的过程分']},
  {title:'保研资格优先型', color:'var(--ability)',
    tags:['冲刺高权重必修课','为绩点上限留出空间']},
  {title:'控制每周学习时间型', color:'var(--plan)',
    tags:['优先低学分高效率课程','为实习/竞赛预留时间']},
];
function renderPlanCards(){
  const wrap = document.getElementById('planCards');
  wrap.innerHTML = planDefs.map(p=>`
    <div class="plan-card">
      <h3 style="color:${p.color}">${p.title}</h3>
      <div class="plan-tags">${p.tags.map(t=>`<span>${t}</span>`).join('')}</div>
    </div>
  `).join('');
}
renderPlanCards();

/* ---------------- 调用 AI 生成个性化建议 ---------------- */
document.getElementById('matchPlanBtn').onclick = async ()=>{
  const btn = document.getElementById('matchPlanBtn');
  const resultBox = document.getElementById('aiAdviceResult');
  resultBox.style.display = 'block';

  if(!courses.length){
    resultBox.innerHTML = `<div class="empty">先去"绩点档案"里添加至少一门课程，AI 需要看到具体的评分构成才能给建议。</div>`;
    return;
  }

  const targetGpa = parseFloat(document.getElementById('targetGpa').value);
  const finalTargetGpa = parseFloat(document.getElementById('finalTargetGpa').value);
  if(isNaN(targetGpa) || isNaN(finalTargetGpa)){
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>先填两个必填的目标绩点</b>回到"绩点档案 → 个人目标"，把"本学期目标绩点"和"毕业/最终目标绩点"都填上，AI 需要这两个数字才能判断该怎么取舍。</div></div>`;
    return;
  }
  if(!isCurrentGpaProvided()){
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>先填"目前绩点"</b>回到"绩点档案 → 历史均绩"，填一下目前绩点，如果你是大一新生还没有绩点，勾选那个选项就行。</div></div>`;
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'AI 正在分析…';
  resultBox.innerHTML = `<div class="empty">AI 正在根据你的课程和目标生成建议，通常需要几秒到十几秒…</div>`;

  const otherGoals = [...document.querySelectorAll('.goal-check:checked')].map(c=>c.value);
  const otherGoalsText = document.getElementById('otherGoalsText').value.trim();
  const candidateCourses = getCandidateCoursesFromDOM();
  const candidateConflicts = findConflicts(candidateCourses).map(c=>({
    courseA: c.a, courseB: c.b,
    day: WEEKDAY_LABEL[c.day],
    slotA: `${c.aSlot.start}-${c.aSlot.end}节`,
    slotB: `${c.bSlot.start}-${c.bSlot.end}节`
  }));

  const payload = {
    courses: courses.map(c=>({
      name: c.name,
      credit: c.credit,
      target: c.target,
      items: c.items.map(it=>({name: it.name, weight: it.weight, score: it.score}))
    })),
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
    const advice = await getAIAdvice(payload);
    renderAIAdvice(advice);
  } catch (err) {
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>生成失败</b>${escapeHtml(err.message || '请稍后重试')}</div></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

function renderAIAdvice(advice){
  const resultBox = document.getElementById('aiAdviceResult');
  if(!advice){
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>没有收到有效结果</b>请重试一次。</div></div>`;
    return;
  }
  let html = `<div class="card" style="margin-top:16px; border-color:var(--plan);">`;
  html += `<h3 style="margin-top:0; color:var(--plan);">AI 个性化建议</h3>`;
  html += `<p style="color:var(--ink-soft); margin-bottom:16px;">${escapeHtml(advice.summary || '')}</p>`;

  if(Array.isArray(advice.options) && advice.options.length){
    html += `<div class="grid cols-3">` + advice.options.map(o=>`
      <div class="plan-card">
        <h3>${escapeHtml(o.title || '')}</h3>
        <p style="font-size:13px; color:var(--ink-soft); margin:0;">${escapeHtml(o.description || '')}</p>
      </div>
    `).join('') + `</div>`;
  }

  if(Array.isArray(advice.risks) && advice.risks.length){
    html += `<div class="caution" style="margin-top:16px;"><div>⚠️</div><div><b>需要注意</b>${advice.risks.map(escapeHtml).join('；')}</div></div>`;
  }

  html += `</div>`;
  resultBox.innerHTML = html;
}

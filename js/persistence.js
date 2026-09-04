/* ---------------- 数据持久化（登录后保存/恢复整页数据） ----------------
   collectAppState()：把当前页面所有输入打包成一个 JSON 对象
   applyAppState(data)：反过来，把保存过的数据灌回页面所有输入框

   这里没有做自动保存（比如每次输入就存一次）——那样请求太频繁，
   而且这个量级的表单数据没必要。改成一个明确的"保存我的数据"按钮，
   用户自己决定什么时候存。 */

function collectAppState(){
  const otherGoals = [...document.querySelectorAll('.goal-check:checked')].map(c=>c.value);
  return {
    courses,
    gpaScale: document.getElementById('gpaScale').value,
    customScaleTable,
    targetGpa: document.getElementById('targetGpa').value,
    finalTargetGpa: document.getElementById('finalTargetGpa').value,
    otherGoals,
    otherGoalsText: document.getElementById('otherGoalsText').value,
    manualCurrentGpa: document.getElementById('manualCurrentGpa').value,
    historyCourses: typeof getHistoryCoursesFromDOM === 'function' ? getHistoryCoursesFromDOM() : [],
    abilitySelfRating: typeof getAbilitySelfRatingFromDOM === 'function' ? getAbilitySelfRatingFromDOM() : {},
    candidateCourses: typeof getCandidateCoursesFromDOM === 'function' ? getCandidateCoursesFromDOM() : [],
    weeklyHours: document.getElementById('weeklyHours').value,
    priorityGoal: document.getElementById('priorityGoal').value,
    hasOutside: document.getElementById('hasOutside').value
  };
}

function applyAppState(data){
  if(!data) return;

  if(Array.isArray(data.courses)){
    courses = data.courses;
    courseIdSeq = courses.reduce((max,c)=> Math.max(max, c.id||0), 0) + 1;
  }
  if(data.gpaScale) document.getElementById('gpaScale').value = data.gpaScale;
  document.getElementById('customScalePanel').style.display = data.gpaScale === 'custom' ? 'block' : 'none';
  if(Array.isArray(data.customScaleTable) && data.customScaleTable.length && typeof addCustomScaleRow === 'function'){
    document.getElementById('customScaleRows').innerHTML = '';
    data.customScaleTable.forEach(([min,pt])=>{
      if(min===0 && pt===0) return; // 兜底档不需要显示成一行，rebuild 时会自动补
      addCustomScaleRow(min, pt);
    });
    if(typeof computeCustomScaleTableFromDOM === 'function') computeCustomScaleTableFromDOM();
  }
  if(data.targetGpa !== undefined) document.getElementById('targetGpa').value = data.targetGpa;
  if(data.finalTargetGpa !== undefined) document.getElementById('finalTargetGpa').value = data.finalTargetGpa;
  if(data.otherGoalsText !== undefined) document.getElementById('otherGoalsText').value = data.otherGoalsText;
  if(data.manualCurrentGpa !== undefined) document.getElementById('manualCurrentGpa').value = data.manualCurrentGpa;
  if(Array.isArray(data.otherGoals)){
    document.querySelectorAll('.goal-check').forEach(cb=>{
      cb.checked = data.otherGoals.includes(cb.value);
    });
  }

  if(Array.isArray(data.historyCourses) && typeof addHistoryRow === 'function'){
    document.getElementById('historyRows').innerHTML = '';
    data.historyCourses.forEach(it => addHistoryRow(it.name||'', it.credit ?? '', it.score ?? '', it.tag||''));
  }
  if(typeof renderHistoryGpaSummary === 'function') renderHistoryGpaSummary();

  if(data.abilitySelfRating && typeof abilityDims !== 'undefined'){
    abilityDims.forEach(d=>{
      const val = data.abilitySelfRating[d.label];
      if(val === undefined || val === null) return;
      const inp = document.querySelector(`#abilitySliders input[data-dim="${d.key}"]`);
      if(!inp) return;
      inp.value = val;
      const valLabel = document.getElementById('aval-'+d.key);
      const bar = document.getElementById('abar-'+d.key);
      if(valLabel) valLabel.textContent = val;
      if(bar) bar.style.width = val+'%';
    });
  }

  if(Array.isArray(data.candidateCourses) && typeof addCandidateRow === 'function'){
    document.getElementById('candidateRows').innerHTML = '';
    data.candidateCourses.forEach(it => addCandidateRow(it.name||'', it.credit ?? '', it.type||'选修', it.time||''));
    if(typeof renderCandidateConflicts === 'function') renderCandidateConflicts();
  }

  if(data.weeklyHours !== undefined) document.getElementById('weeklyHours').value = data.weeklyHours;
  if(data.priorityGoal) document.getElementById('priorityGoal').value = data.priorityGoal;
  if(data.hasOutside) document.getElementById('hasOutside').value = data.hasOutside;

  renderCourses();
}

async function saveUserData(){
  const res = await fetch('/api/user-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collectAppState())
  });
  if(!res.ok){
    let message = '保存失败，请稍后重试';
    try { const err = await res.json(); if(err.error) message = err.error; } catch(e){}
    throw new Error(message);
  }
}

async function loadUserData(){
  const res = await fetch('/api/user-data');
  if(!res.ok) return;
  const data = await res.json();
  if(data.data) applyAppState(data.data);
}

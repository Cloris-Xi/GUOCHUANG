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

/* 供 ability-diagnosis 接口读取当前的自评分数 */
function getAbilitySelfRatingFromDOM(){
  const result = {};
  abilityDims.forEach(d=>{
    const inp = document.querySelector(`#abilitySliders input[data-dim="${d.key}"]`);
    result[d.label] = inp ? parseInt(inp.value, 10) : null;
  });
  return result;
}

/* ---------------- 调用 AI 生成能力与方向诊断 ---------------- */
document.getElementById('diagnoseAbilityBtn').onclick = async ()=>{
  const btn = document.getElementById('diagnoseAbilityBtn');
  const resultBox = document.getElementById('abilityDiagnosisResult');
  resultBox.style.display = 'block';

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'AI 正在分析…';
  resultBox.innerHTML = `<div class="empty">AI 正在结合历史成绩和自评生成诊断，通常需要几秒到十几秒…</div>`;

  const payload = {
    historyCourses: getHistoryCoursesFromDOM(),
    abilitySelfRating: getAbilitySelfRatingFromDOM()
  };

  try {
    const diagnosis = await getAbilityDiagnosis(payload);
    renderAbilityDiagnosis(diagnosis);
  } catch (err) {
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>生成失败</b>${escapeHtml(err.message || '请稍后重试')}</div></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

function renderAbilityDiagnosis(d){
  const resultBox = document.getElementById('abilityDiagnosisResult');
  if(!d){
    resultBox.innerHTML = `<div class="caution"><div>⚠️</div><div><b>没有收到有效结果</b>请重试一次。</div></div>`;
    return;
  }
  let html = `<div class="card" style="margin-top:16px; border-color:var(--ability);">`;
  html += `<p style="font-size:12.5px; color:var(--ink-soft); margin-top:0;">${escapeHtml(d.dataNote || '')}</p>`;

  if(Array.isArray(d.strengths) && d.strengths.length){
    html += `<div style="margin-bottom:14px;"><b style="color:var(--ability);">相对优势方向</b><ul style="margin:8px 0 0; padding-left:20px; font-size:14px;">`;
    html += d.strengths.map(s=>`<li>${escapeHtml(s)}</li>`).join('');
    html += `</ul></div>`;
  }
  if(Array.isArray(d.watchOuts) && d.watchOuts.length){
    html += `<div style="margin-bottom:14px;"><b style="color:var(--ink-soft);">还看不出来 / 需要留意</b><ul style="margin:8px 0 0; padding-left:20px; font-size:14px; color:var(--ink-soft);">`;
    html += d.watchOuts.map(s=>`<li>${escapeHtml(s)}</li>`).join('');
    html += `</ul></div>`;
  }
  if(d.suggestion){
    html += `<div class="caution" style="background:var(--ability-soft); border-color:transparent; color:var(--ink);"><div>💡</div><div>${escapeHtml(d.suggestion)}</div></div>`;
  }

  html += `</div>`;
  resultBox.innerHTML = html;
}

/* ---------------- Module 2: Simulator ---------------- */
function renderSimSelect(){
  const sel = document.getElementById('simCourseSelect');
  const prev = sel.value;
  sel.innerHTML = courses.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if(courses.some(c=>String(c.id)===prev)) sel.value = prev;
  renderSimBody();
}
document.getElementById('simCourseSelect').addEventListener('change', renderSimBody);

function renderSimBody(){
  const body = document.getElementById('simBody');
  if(!courses.length){
    body.innerHTML = `<div class="empty" style="margin-top:16px;">先去"绩点档案"里添加课程。</div>`;
    return;
  }
  const id = parseInt(document.getElementById('simCourseSelect').value);
  const course = courses.find(c=>c.id===id) || courses[0];
  if(!course){ body.innerHTML=''; return; }
  const scale = document.getElementById('gpaScale').value;
  simAssumed[course.id] = simAssumed[course.id] || {};

  let html = `<div style="margin-top:18px;">`;
  course.items.forEach((it,idx)=>{
    if(it.score!==null){
      html += `<div class="slider-row"><div class="top"><span class="name">${it.name}（权重${it.weight}%）</span><span>已知：${it.score} 分</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${it.score}%; background:var(--sim);"></div></div></div>`;
    } else {
      const cur = simAssumed[course.id][it.name] !== undefined ? simAssumed[course.id][it.name] : 75;
      html += `<div class="slider-row">
        <div class="top"><span class="name">${it.name}（权重${it.weight}%，待公布）</span><span id="simval-${idx}">${cur} 分</span></div>
        <input type="range" min="0" max="100" value="${cur}" data-item="${it.name}" data-idx="${idx}">
      </div>`;
    }
  });
  html += `</div>`;

  body.innerHTML = html;

  // stats row rendered after sliders
  const statsWrap = document.createElement('div');
  statsWrap.className='grid cols-3';
  statsWrap.style.marginTop='18px';
  body.appendChild(statsWrap);

  function refreshStats(){
    const total = courseAssumedTotal(course);
    const gpaPoint = scoreToGpa(total, scale);
    const {known, remaining} = courseKnownTotal(course);
    let riskLabel='—', riskColor='var(--ink-soft)';
    if(course.target!==null){
      const gap = course.target - total;
      if(gap<=0){ riskLabel='已达标'; riskColor='var(--ok)'; }
      else if(remaining>0){
        const needed = (course.target-known)/(remaining/100);
        if(needed<=85){ riskLabel='达标可能性较高'; riskColor='var(--ok)'; }
        else if(needed<=100){ riskLabel='需要发挥出色'; riskColor='var(--mid)'; }
        else { riskLabel='当前假设下较难达标'; riskColor='var(--warn)'; }
      }
    }
    statsWrap.innerHTML = `
      <div class="stat" style="background:var(--sim-soft);"><div class="v" style="color:var(--sim);">${total.toFixed(1)}</div><div class="l">预估课程总评</div></div>
      <div class="stat" style="background:var(--profile-soft);"><div class="v" style="color:var(--profile);">${gpaPoint.toFixed(2)}</div><div class="l">对应绩点（${scale}制）</div></div>
      <div class="stat" style="background:var(--ability-soft);"><div class="v" style="color:${riskColor}; font-size:18px;">${riskLabel}</div><div class="l">${course.target!==null? '目标总评 '+course.target+' 分' : '未设置课程目标'}</div></div>
    `;
  }
  refreshStats();

  body.querySelectorAll('input[type=range]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const itemName = inp.dataset.item;
      simAssumed[course.id][itemName] = parseFloat(inp.value);
      const label = document.getElementById('simval-'+inp.dataset.idx);
      if(label) label.textContent = inp.value + ' 分';
      refreshStats();
      renderCourses(); // keep hero + profile list in sync (without re-rendering sim body)
    });
  });

  document.getElementById('caution-note-sim') || (()=>{
    const note = document.createElement('div');
    note.className='caution'; note.id='caution-note-sim';
    note.innerHTML = `<div>ⓘ</div><div><b>这是估计区间，不是确定结果</b>滑块反映的是"如果发挥成这样"，实际成绩仍取决于考试本身、给分尺度等因素。</div>`;
    body.appendChild(note);
  })();
}

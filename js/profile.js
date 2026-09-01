/* ---------------- Item rows (profile form) ---------------- */
function addItemRow(name='', weight='', score=''){
  const row = document.createElement('div');
  row.className='item-row';
  row.innerHTML = `
    <input type="text" class="it-name" placeholder="评分项，如 期末考试" value="${name}">
    <input type="number" class="it-weight" placeholder="权重%" value="${weight}">
    <input type="number" class="it-score" placeholder="成绩(可空)" value="${score}">
    <button class="remove-x" title="删除">×</button>`;
  row.querySelector('.remove-x').onclick = ()=> row.remove();
  document.getElementById('itemRows').appendChild(row);
}
document.getElementById('addItemBtn').onclick = ()=> addItemRow();
addItemRow('平时作业','20','');
addItemRow('考勤与课堂表现','10','');
addItemRow('小组项目','20','');
addItemRow('期中考试','20','');
addItemRow('期末考试','30','');

document.getElementById('addCourseBtn').onclick = ()=>{
  const name = document.getElementById('cName').value.trim();
  const credit = parseFloat(document.getElementById('cCredit').value);
  const target = document.getElementById('cTarget').value ? parseFloat(document.getElementById('cTarget').value) : null;
  if(!name || !credit){ alert('请填写课程名称和学分'); return; }
  const rows = [...document.querySelectorAll('#itemRows .item-row')];
  const items = rows.map(r=>({
    name: r.querySelector('.it-name').value.trim() || '未命名评分项',
    weight: parseFloat(r.querySelector('.it-weight').value) || 0,
    score: r.querySelector('.it-score').value === '' ? null : parseFloat(r.querySelector('.it-score').value)
  })).filter(it=>it.weight>0);
  if(items.length===0){ alert('至少添加一个有效权重的评分项'); return; }
  courses.push({id: courseIdSeq++, name, credit, target, items});
  document.getElementById('cName').value=''; document.getElementById('cCredit').value=''; document.getElementById('cTarget').value='';
  renderCourses();
};

document.getElementById('demoBtn').onclick = ()=>{
  courses = [
    {id:courseIdSeq++, name:'数据结构', credit:3, target:88,
      items:[{name:'平时作业',weight:20,score:92},{name:'考勤',weight:10,score:100},{name:'小组项目',weight:20,score:85},{name:'期中考试',weight:20,score:78},{name:'期末考试',weight:30,score:null}]},
    {id:courseIdSeq++, name:'概率论', credit:3, target:82,
      items:[{name:'作业',weight:30,score:80},{name:'期中',weight:30,score:74},{name:'期末',weight:40,score:null}]},
    {id:courseIdSeq++, name:'专业英语写作', credit:2, target:null,
      items:[{name:'课堂表现',weight:20,score:90},{name:'论文初稿',weight:30,score:88},{name:'期末论文',weight:50,score:null}]}
  ];
  document.getElementById('targetGpa').value = 3.6;
  renderCourses();
};

document.getElementById('gpaScale').onchange = ()=>{ renderCourses(); renderSimBody(); };
document.getElementById('targetGpa').oninput = ()=>{ renderCourses(); };

/* ---------------- Compute helpers ---------------- */
function courseAssumedTotal(course){
  const assumed = simAssumed[course.id] || {};
  let total = 0;
  for(const it of course.items){
    const s = it.score!==null ? it.score : (assumed[it.name] !== undefined ? assumed[it.name] : 75);
    total += s * it.weight/100;
  }
  return total;
}
function courseKnownTotal(course){
  let known=0, knownWeight=0;
  for(const it of course.items){ if(it.score!==null){ known += it.score*it.weight/100; knownWeight += it.weight; } }
  return {known, knownWeight, remaining: 100-knownWeight};
}

/* ---------------- Render: Course list ---------------- */
function renderCourses(){
  const scale = document.getElementById('gpaScale').value;
  const list = document.getElementById('courseList');
  const empty = document.getElementById('profileEmpty');
  list.innerHTML='';
  empty.style.display = courses.length? 'none':'block';

  let creditSum=0, gpaSum=0;
  courses.forEach(c=>{
    const {known, knownWeight, remaining} = courseKnownTotal(c);
    const assumedTotal = courseAssumedTotal(c);
    const gpaPoint = scoreToGpa(assumedTotal, scale);
    creditSum += c.credit; gpaSum += gpaPoint*c.credit;

    let neededMsg = '';
    if(c.target!==null && remaining>0){
      const needed = (c.target - known) / (remaining/100);
      if(needed>100) neededMsg = `目标 ${c.target} 分：即使剩余项全满分也难以达到`;
      else if(needed<0) neededMsg = `目标 ${c.target} 分：已锁定达成`;
      else neededMsg = `目标 ${c.target} 分：剩余项平均需 ${needed.toFixed(1)} 分`;
    }

    const div = document.createElement('div');
    div.className='course-card';
    div.innerHTML = `
      <h3>${c.name} <span class="pill" style="background:var(--profile-soft); color:var(--profile);">${c.credit} 学分</span></h3>
      <div class="course-meta">已知权重完成 ${knownWeight}% · 剩余 ${remaining}% ${neededMsg? '· '+neededMsg : ''}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${knownWeight}%; background:var(--profile);"></div></div>
      <div class="course-meta">按当前假设（未公布项默认按75分估算）：加权总评 ≈ <b>${assumedTotal.toFixed(1)}</b> 分 → 绩点 <b>${gpaPoint.toFixed(2)}</b></div>
    `;
    list.appendChild(div);
  });

  const overallGpa = creditSum? (gpaSum/creditSum) : 0;
  document.getElementById('heroGpa').textContent = courses.length? overallGpa.toFixed(2) : '--';
  document.getElementById('heroCourses').textContent = courses.length + ' 门';
  const targetGpa = parseFloat(document.getElementById('targetGpa').value);
  if(!isNaN(targetGpa) && courses.length){
    const gap = (targetGpa - overallGpa).toFixed(2);
    document.getElementById('heroGap').textContent = gap>0 ? `还差 ${gap}` : '已达标';
  } else {
    document.getElementById('heroGap').textContent = courses.length? '未设置目标' : '未设置目标';
  }
  // focus course = highest remaining weight * credit
  if(courses.length){
    let best=null, bestScore=-1;
    courses.forEach(c=>{
      const {remaining} = courseKnownTotal(c);
      const score = remaining/100 * c.credit;
      if(score>bestScore){ bestScore=score; best=c; }
    });
    document.getElementById('heroFocus').textContent = best ? best.name : '--';
  } else {
    document.getElementById('heroFocus').textContent = '--';
  }

  renderSimSelect();
  renderMatrix();
}

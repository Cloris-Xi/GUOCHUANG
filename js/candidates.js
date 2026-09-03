/* ---------------- 候选课程（个性化选课建议用） ----------------
   "已有专业课" + "想选的选修课"放在同一张表里，用 type 字段区分。
   时间冲突检测是纯前端的规则计算，不需要 AI：解析"周二 3-4节；周四 1-2节"
   这种格式，两两比较有没有同一天、节次有重叠的课。 */

function addCandidateRow(name='', credit='', type='选修', time=''){
  const row = document.createElement('div');
  row.className = 'item-row';
  row.style.gridTemplateColumns = '1.3fr 60px 80px 1.2fr 30px';
  row.innerHTML = `
    <input type="text" class="cd-name" placeholder="课程名称" value="${escapeHtml(name)}">
    <input type="number" class="cd-credit" placeholder="学分" value="${escapeHtml(credit)}">
    <select class="cd-type">
      <option value="必修" ${type==='必修'?'selected':''}>必修</option>
      <option value="选修" ${type==='选修'?'selected':''}>选修</option>
    </select>
    <input type="text" class="cd-time" placeholder="例：周二 3-4节；周四 1-2节" value="${escapeHtml(time)}">
    <button class="remove-x" title="删除">×</button>`;
  row.querySelector('.remove-x').onclick = ()=>{ row.remove(); renderCandidateConflicts(); };
  row.querySelectorAll('input, select').forEach(inp=> inp.addEventListener('input', renderCandidateConflicts));
  row.querySelector('.cd-type').addEventListener('change', renderCandidateConflicts);
  document.getElementById('candidateRows').appendChild(row);
  renderCandidateConflicts();
}

document.getElementById('addCandidateRowBtn').onclick = ()=> addCandidateRow();

function getCandidateCoursesFromDOM(){
  const rows = [...document.querySelectorAll('#candidateRows .item-row')];
  return rows.map(r => ({
    name: r.querySelector('.cd-name').value.trim(),
    credit: r.querySelector('.cd-credit').value === '' ? null : parseFloat(r.querySelector('.cd-credit').value),
    type: r.querySelector('.cd-type').value,
    time: r.querySelector('.cd-time').value.trim()
  })).filter(it => it.name);
}

/* ---------------- 时间冲突检测（纯规则，不靠 AI） ---------------- */

const WEEKDAY_MAP = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '日':7, '天':7 };

/* 把 "周二 3-4节；周四 1-2节" 这种字符串解析成 [{day, start, end}, ...]
   解析不了的部分直接忽略，不报错——用户格式写得不规范时，宁可少查出一些
   冲突，也不要因为解析失败打断整个流程。 */
function parseTimeSlots(timeStr){
  if(!timeStr) return [];
  const slots = [];
  const regex = /周([一二三四五六日天])\s*([0-9]+)\s*-\s*([0-9]+)\s*节/g;
  let m;
  while((m = regex.exec(timeStr)) !== null){
    const day = WEEKDAY_MAP[m[1]];
    const start = parseInt(m[2], 10);
    const end = parseInt(m[3], 10);
    if(day && !isNaN(start) && !isNaN(end)) slots.push({ day, start, end });
  }
  return slots;
}

function slotsOverlap(a, b){
  return a.day === b.day && a.start <= b.end && b.start <= a.end;
}

function findConflicts(courses){
  const parsed = courses.map(c => ({ ...c, slots: parseTimeSlots(c.time) }));
  const conflicts = [];
  for(let i=0; i<parsed.length; i++){
    for(let j=i+1; j<parsed.length; j++){
      const a = parsed[i], b = parsed[j];
      for(const sa of a.slots){
        for(const sb of b.slots){
          if(slotsOverlap(sa, sb)){
            conflicts.push({ a: a.name, b: b.name, day: sa.day, aSlot: sa, bSlot: sb });
          }
        }
      }
    }
  }
  return conflicts;
}

const WEEKDAY_LABEL = { 1:'周一', 2:'周二', 3:'周三', 4:'周四', 5:'周五', 6:'周六', 7:'周日' };

function renderCandidateConflicts(){
  const box = document.getElementById('candidateConflicts');
  if(!box) return;
  const courses = getCandidateCoursesFromDOM();
  const conflicts = findConflicts(courses);
  if(!courses.length){
    box.innerHTML = '';
    return;
  }
  if(!conflicts.length){
    box.innerHTML = `<div class="caution" style="background:#EAF7F1; border-color:#BEE7D3; color:#0E7A5E;"><div>✅</div><div>目前填的课程里没有检测到时间冲突（前提是"上课时间"按建议格式填了）。</div></div>`;
    return;
  }
  const items = conflicts.map(c=>
    `<li>「${escapeHtml(c.a)}」和「${escapeHtml(c.b)}」在 ${WEEKDAY_LABEL[c.day]} 第${c.aSlot.start}-${c.aSlot.end}节 / 第${c.bSlot.start}-${c.bSlot.end}节 有重叠</li>`
  ).join('');
  box.innerHTML = `<div class="caution"><div>⚠️</div><div><b>检测到 ${conflicts.length} 处时间冲突</b><ul style="margin:6px 0 0; padding-left:18px;">${items}</ul></div></div>`;
}

/* ---------------- 拖拽 / 点击导入选课系统截图 ---------------- */
const candidateDropzone = document.getElementById('candidateDropzone');
const candidateImageInput = document.getElementById('candidateImageInput');

candidateDropzone.addEventListener('click', ()=> candidateImageInput.click());

['dragenter','dragover'].forEach(evt=>{
  candidateDropzone.addEventListener(evt, e=>{
    e.preventDefault(); e.stopPropagation();
    candidateDropzone.classList.add('dragover');
  });
});
['dragleave','drop'].forEach(evt=>{
  candidateDropzone.addEventListener(evt, e=>{
    e.preventDefault(); e.stopPropagation();
    candidateDropzone.classList.remove('dragover');
  });
});
candidateDropzone.addEventListener('drop', e=>{
  const files = [...(e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/'));
  if(files.length) handleCandidateImages(files);
});
candidateImageInput.addEventListener('change', e=>{
  const files = [...e.target.files];
  e.target.value = '';
  if(files.length) handleCandidateImages(files);
});

async function handleCandidateImages(files){
  const status = document.getElementById('candidateImportStatus');
  let okCount = 0, failMessages = [];

  for(let i=0; i<files.length; i++){
    status.innerHTML = `<div class="empty" style="margin-bottom:12px;">AI 正在识别第 ${i+1}/${files.length} 张图片…</div>`;
    try {
      const dataUrl = await resizeImageToBase64(files[i]);
      const items = await getScheduleItemsFromImage(dataUrl);
      items.forEach(it => addCandidateRow(it.name || '未命名课程', it.credit ?? '', it.type === '必修' ? '必修' : '选修', it.time || ''));
      okCount += items.length;
    } catch (err) {
      failMessages.push(`第 ${i+1} 张：${err.message || '识别失败'}`);
    }
  }

  if(okCount === 0 && failMessages.length){
    status.innerHTML = `<div class="caution"><div>⚠️</div><div><b>识别失败</b>${failMessages.map(escapeHtml).join('；')}</div></div>`;
  } else if(failMessages.length){
    status.innerHTML = `<div class="caution" style="background:#EAF7F1; border-color:#BEE7D3; color:#0E7A5E;"><div>✅</div><div><b>识别到 ${okCount} 门课程</b>其中 ${failMessages.length} 张图片没能成功识别，已跳过；识别结果和上课时间请务必核对。</div></div>`;
  } else {
    status.innerHTML = `<div class="caution" style="background:#EAF7F1; border-color:#BEE7D3; color:#0E7A5E;"><div>✅</div><div><b>已识别 ${okCount} 门课程</b>已经加到下面的列表里，上课时间的识别准确率不如学分和名称，务必核对一遍再看冲突检测结果。</div></div>`;
  }
}

/* ---------------- 历史成绩（可选，大一新生可以跳过） ----------------
   数据结构比"绩点档案"里的当前课程简单很多：历史课程已经有定论了，
   不需要评分构成拆分，只要 名称/学分/最终成绩/课程类型标签 四项。
   行是直接可编辑的（和 profile.js 里的 itemRows 是一个思路），
   手动添加的行和拖拽图片识别出来的行长在同一个列表里，可以混用。 */

function addHistoryRow(name='', credit='', score='', tag=''){
  const row = document.createElement('div');
  row.className = 'item-row';
  row.style.gridTemplateColumns = '1.4fr 70px 70px 90px 30px';
  row.innerHTML = `
    <input type="text" class="hi-name" placeholder="课程名称" value="${escapeHtml(name)}">
    <input type="number" class="hi-credit" placeholder="学分" value="${escapeHtml(credit)}">
    <input type="number" class="hi-score" placeholder="成绩" value="${escapeHtml(score)}">
    <input type="text" class="hi-tag" placeholder="类型(可选)" value="${escapeHtml(tag)}">
    <button class="remove-x" title="删除">×</button>`;
  row.querySelector('.remove-x').onclick = ()=>{ row.remove(); renderHistoryGpaSummary(); };
  row.querySelectorAll('input').forEach(inp=> inp.addEventListener('input', renderHistoryGpaSummary));
  document.getElementById('historyRows').appendChild(row);
  renderHistoryGpaSummary();
}

document.getElementById('addHistoryRowBtn').onclick = ()=> addHistoryRow();

/* 从 DOM 里读取当前所有历史成绩行，过滤掉完全空白的行 */
function getHistoryCoursesFromDOM(){
  const rows = [...document.querySelectorAll('#historyRows .item-row')];
  return rows.map(r => ({
    name: r.querySelector('.hi-name').value.trim(),
    credit: r.querySelector('.hi-credit').value === '' ? null : parseFloat(r.querySelector('.hi-credit').value),
    score: r.querySelector('.hi-score').value === '' ? null : parseFloat(r.querySelector('.hi-score').value),
    tag: r.querySelector('.hi-tag').value.trim() || '其他'
  })).filter(it => it.name);
}

/* "历史均绩"这一块名字就叫这个，所以实际算一个学分加权的历史平均绩点出来，
   而不是只把历史课程列出来。用的是当前"绩点制度"选的换算制式。如果学生
   在上面直接手动填了"目前绩点"，优先展示手动填的那个（更准，因为教务
   系统算的可能包含了这里没录全的课程），逐门算出来的平均分退居参考。 */
function renderHistoryGpaSummary(){
  const box = document.getElementById('historyGpaSummary');
  if(!box) return;
  const items = getHistoryCoursesFromDOM().filter(it => it.credit && it.score !== null);
  const manualVal = document.getElementById('manualCurrentGpa').value;

  if(!items.length && !manualVal){
    box.innerHTML = '';
    return;
  }

  const scale = document.getElementById('gpaScale').value;
  let creditSum = 0, gpaSum = 0;
  items.forEach(it=>{
    creditSum += it.credit;
    gpaSum += scoreToGpa(it.score, scale) * it.credit;
  });
  const avgGpa = creditSum ? (gpaSum / creditSum) : 0;

  let html = '';
  if(manualVal){
    html += `<div class="stat" style="background:var(--profile-soft);"><div class="v" style="color:var(--profile);">${escapeHtml(manualVal)}</div><div class="l">目前绩点（你手动填的，AI 会优先用这个）</div></div>`;
  }
  if(items.length){
    html += `
      <div class="stat" style="background:${manualVal?'var(--sim-soft)':'var(--profile-soft)'};"><div class="v" style="color:var(--sim);">${avgGpa.toFixed(2)}</div><div class="l">按下面课程逐门算出的平均绩点（${scale}制）</div></div>
      <div class="stat" style="background:var(--ability-soft);"><div class="v" style="color:var(--ability);">${creditSum}</div><div class="l">已录入学分</div></div>
      <div class="stat" style="background:var(--matrix-soft);"><div class="v" style="color:var(--matrix);">${items.length}</div><div class="l">已录入课程数</div></div>
    `;
  }
  box.innerHTML = html;
}
document.getElementById('manualCurrentGpa').addEventListener('input', renderHistoryGpaSummary);

/* ---------------- 拖拽 / 点击导入成绩单截图 ---------------- */
const historyDropzone = document.getElementById('historyDropzone');
const historyImageInput = document.getElementById('historyImageInput');

historyDropzone.addEventListener('click', ()=> historyImageInput.click());

['dragenter','dragover'].forEach(evt=>{
  historyDropzone.addEventListener(evt, e=>{
    e.preventDefault(); e.stopPropagation();
    historyDropzone.classList.add('dragover');
  });
});
['dragleave','drop'].forEach(evt=>{
  historyDropzone.addEventListener(evt, e=>{
    e.preventDefault(); e.stopPropagation();
    historyDropzone.classList.remove('dragover');
  });
});
historyDropzone.addEventListener('drop', e=>{
  const files = [...(e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/'));
  if(files.length) handleHistoryImages(files);
});
historyImageInput.addEventListener('change', e=>{
  const files = [...e.target.files];
  e.target.value = ''; // 允许重复选同一批文件
  if(files.length) handleHistoryImages(files);
});

async function handleHistoryImages(files){
  const status = document.getElementById('historyImportStatus');
  let okCount = 0, failMessages = [];

  for(let i=0; i<files.length; i++){
    status.innerHTML = `<div class="empty" style="margin-bottom:12px;">AI 正在识别第 ${i+1}/${files.length} 张图片…</div>`;
    try {
      const dataUrl = await resizeImageToBase64(files[i]);
      const items = await getTranscriptItemsFromImage(dataUrl);
      items.forEach(it => addHistoryRow(it.name || '未命名课程', it.credit ?? '', it.score ?? '', it.tag || ''));
      okCount += items.length;
    } catch (err) {
      failMessages.push(`第 ${i+1} 张：${err.message || '识别失败'}`);
    }
  }

  if(okCount === 0 && failMessages.length){
    status.innerHTML = `<div class="caution"><div>⚠️</div><div><b>识别失败</b>${failMessages.map(escapeHtml).join('；')}</div></div>`;
  } else if(failMessages.length){
    status.innerHTML = `<div class="caution" style="background:#EAF7F1; border-color:#BEE7D3; color:#0E7A5E;"><div>✅</div><div><b>识别到 ${okCount} 门课程</b>其中 ${failMessages.length} 张图片没能成功识别，已跳过；识别结果请核对后再使用。</div></div>`;
  } else {
    status.innerHTML = `<div class="caution" style="background:#EAF7F1; border-color:#BEE7D3; color:#0E7A5E;"><div>✅</div><div><b>已识别 ${okCount} 门历史课程</b>已经加到下面的表格里，核对无误就行，不用额外保存。</div></div>`;
  }
}

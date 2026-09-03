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
  row.querySelector('.remove-x').onclick = ()=> row.remove();
  document.getElementById('historyRows').appendChild(row);
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

/* ---------------- State ---------------- */
let courses = [];       // {id,name,credit,target,items:[{name,weight,score}]}
let simAssumed = {};    // courseId -> {itemName: assumedScore}
let courseIdSeq = 1;

const scaleTable = {
  "4.0": [[90,4.0],[85,3.7],[82,3.3],[78,3.0],[75,2.7],[72,2.3],[68,2.0],[66,1.7],[64,1.3],[60,1.0],[0,0]],
  "4.3": [[95,4.3],[90,4.0],[85,3.7],[82,3.3],[78,3.0],[75,2.7],[72,2.3],[68,2.0],[66,1.7],[64,1.3],[62,1.0],[0,0]],
  "5.0": [[95,5.0],[90,4.7],[85,4.3],[82,4.0],[78,3.7],[75,3.3],[72,3.0],[68,2.7],[66,2.3],[64,2.0],[62,1.7],[60,1.0],[0,0]]
};
/* 自定义换算表：[[分数下限, 绩点], ...]，用户在"绩点制度"里自己填。
   scoreToGpa 用之前会先按分数下限从高到低排一遍序，用户填的顺序不重要。 */
let customScaleTable = [[90,4.0],[80,3.0],[70,2.0],[60,1.0],[0,0]];

function scoreToGpa(score, scale){
  const table = scale === 'custom' ? customScaleTable : (scaleTable[scale] || scaleTable["4.0"]);
  for(const [min,pt] of table){ if(score>=min) return pt; }
  return 0;
}

/* 全局共用的转义函数：任何要塞进 innerHTML 的用户/AI输入内容都应该过一遍这个，
   放在最先加载的 state.js 里，确保后面所有模块（包括页面初始化时就会跑的
   profile.js 默认行）都能直接调用。 */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* 把图片压缩到最长边 1400px、转成 jpeg，减小上传体积和识别耗时。
   手机拍的原图动辄几MB，压完一般几十到几百KB。评分规则截图导入和
   历史成绩单导入都用这一个函数，放在最先加载的 state.js 里共用。 */
function resizeImageToBase64(file, maxDim=1400, quality=0.85){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=> reject(new Error('图片读取失败，请重试'));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=> reject(new Error('图片解析失败，请换一张试试'));
      img.onload = ()=>{
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          const ratio = Math.min(maxDim/width, maxDim/height);
          width = Math.round(width*ratio);
          height = Math.round(height*ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

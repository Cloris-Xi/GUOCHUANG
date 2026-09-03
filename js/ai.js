/* ====================================================================
   AI 接入层（客户端）

   真正的模型调用发生在 /api/course-advice.js（Vercel Serverless
   Function）里，这里只是浏览器端发请求、处理错误的一层薄封装。
   Anthropic API Key 只存在于服务器端的环境变量里，前端代码永远
   看不到它——这是必须的，因为浏览器代码任何人都能看到源码。
   ==================================================================== */

/**
 * 把当前的课程数据 + 目标发给后端，换回 AI 生成的个性化建议。
 * @param {object} payload - { courses, targetGpa, gpaScale, weeklyHours, priorityGoal, hasOutside }
 * @returns {Promise<{summary:string, options:Array<{title:string, description:string}>, risks:string[]}>}
 */
async function getAIAdvice(payload) {
  const res = await fetch('/api/course-advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let message = '生成失败，请稍后重试';
    try {
      const err = await res.json();
      if (err.error) message = err.error;
    } catch (e) {
      /* 后端没返回 JSON，就用默认提示 */
    }
    throw new Error(message);
  }

  const data = await res.json();
  return data.advice;
}

/**
 * 把一张图片（课程大纲/评分规则截图）发给后端，换回识别出的评分项数组。
 * @param {string} imageDataUrl - canvas.toDataURL() 得到的 "data:image/jpeg;base64,...." 字符串
 * @returns {Promise<Array<{name:string, weight:number, score:number|null}>>}
 */
async function getGradingItemsFromImage(imageDataUrl) {
  const res = await fetch('/api/parse-grading-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: imageDataUrl })
  });

  if (!res.ok) {
    let message = '识别失败，请稍后重试';
    try {
      const err = await res.json();
      if (err.error) message = err.error;
    } catch (e) {
      /* 后端没返回 JSON，就用默认提示 */
    }
    throw new Error(message);
  }

  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * 把一张历史成绩单/教务系统截图发给后端，换回识别出的历史课程数组。
 * @param {string} imageDataUrl
 * @returns {Promise<Array<{name:string, credit:number|null, score:number|null, tag:string}>>}
 */
async function getTranscriptItemsFromImage(imageDataUrl) {
  const res = await fetch('/api/parse-transcript-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: imageDataUrl })
  });

  if (!res.ok) {
    let message = '识别失败，请稍后重试';
    try {
      const err = await res.json();
      if (err.error) message = err.error;
    } catch (e) { /* 忽略 */ }
    throw new Error(message);
  }

  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * 把历史成绩 + 能力自评发给后端，换回 AI 生成的能力与方向诊断。
 * @param {{historyCourses:Array, abilitySelfRating:object}} payload
 * @returns {Promise<{dataNote:string, strengths:string[], watchOuts:string[], suggestion:string}>}
 */
async function getAbilityDiagnosis(payload) {
  const res = await fetch('/api/ability-diagnosis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let message = '生成失败，请稍后重试';
    try {
      const err = await res.json();
      if (err.error) message = err.error;
    } catch (e) { /* 忽略 */ }
    throw new Error(message);
  }

  const data = await res.json();
  return data.diagnosis;
}

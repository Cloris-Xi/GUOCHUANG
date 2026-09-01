/* ====================================================================
   AI 接入层（占位）

   对应需求文档里"7. Vibe Coding 的合理落点"：
   - 确定性计算（GPA 换算、加权总评、目标反推、优先级排序）永远留在
     state.js / profile.js / simulator.js / matrix.js 里的规则引擎中，
     不要让大模型直接输出分数或结论。
   - 大模型只负责"理解 + 生成 + 解释"，产出的是结构化数据，
     必须经过学生确认后，再交给规则引擎运算。

   典型接入点（按优先级排序，建议先做第 1 个）：

   1. 解析教师给出的自然语言评分规则 → 结构化评分项
      输入：学生粘贴的课程大纲文字
      输出：[{name, weight}, ...]，供 profile.js 的 addItemRow 使用
      对应文档例子：
        "总评由考勤10%、平时作业20%、实验20%、期中20%、期末30%构成"
        → [{"name":"考勤","weight":10}, {"name":"平时作业","weight":20}, ...]

   2. 把课程总评/绩点结果转成通俗的学习建议文字
      输入：simulator.js 里算出的 total / gpaPoint / riskLabel
      输出：一段自然语言解释，展示在模拟器结果卡片旁边

   3. 学习能力画像的文字总结
      输入：ability.js 里五个维度的自评分数
      输出：一段"可解释性观察"文字（注意：不能是绝对判断）

   出于安全考虑，Anthropic API Key 不应该出现在前端代码里，
   下面的函数假设你会自己起一个后端接口（比如 /api/parse-grading-rule）
   来转发请求、注入密钥。把 API_ENDPOINT 换成你自己的后端地址即可。
   ==================================================================== */

const AI_CONFIG = {
  // 替换成你自己的后端转发地址，不要在前端直接放 API Key
  API_ENDPOINT: '/api/ai',
};

/**
 * 接入点 1：把自然语言评分规则解析成结构化评分项
 * @param {string} rawText - 学生粘贴的课程大纲 / 评分说明文字
 * @returns {Promise<Array<{name:string, weight:number}>>}
 */
async function parseGradingRuleWithAI(rawText) {
  // TODO: 接入真实后端后删掉下面这行 mock，改成真正的 fetch 调用
  console.warn('[ai.js] parseGradingRuleWithAI 还未接入真实模型，当前返回示例数据');
  return mockParseGradingRule(rawText);

  /* 接入真实后端时大概长这样：
  const res = await fetch(`${AI_CONFIG.API_ENDPOINT}/parse-grading-rule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: rawText })
  });
  if (!res.ok) throw new Error('AI 解析失败，请稍后重试或手动填写');
  const data = await res.json();
  return data.items; // [{name, weight}, ...]
  */
}

/**
 * 接入点 2：把计算结果转成通俗的学习建议
 * @param {{courseName:string, total:number, gpaPoint:number, riskLabel:string, target:number|null}} result
 * @returns {Promise<string>}
 */
async function explainResultWithAI(result) {
  console.warn('[ai.js] explainResultWithAI 还未接入真实模型，当前返回占位文案');
  return `（示例文案）按当前假设，「${result.courseName}」预计总评 ${result.total.toFixed(1)} 分，${result.riskLabel}。`;

  /* 接入真实后端时大概长这样：
  const res = await fetch(`${AI_CONFIG.API_ENDPOINT}/explain-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  });
  const data = await res.json();
  return data.explanation;
  */
}

/* ---------------- 本地 mock，先跑通交互，接入模型后可删除 ---------------- */
function mockParseGradingRule(rawText) {
  // 极简规则：从文字里找 "名称 数字%" 的组合，找不到就返回空数组
  const matches = [...rawText.matchAll(/([\u4e00-\u9fa5A-Za-z]+)\s*([0-9]{1,3})\s*%/g)];
  return matches.map(m => ({ name: m[1], weight: parseInt(m[2], 10) }));
}

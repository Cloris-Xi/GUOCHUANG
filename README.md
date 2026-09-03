# 学业罗盘 · 项目结构说明

```
.
├── index.html          页面结构（DOM），不含样式和逻辑
├── css/
│   └── style.css        全部样式，含浅蓝底色和五个模块的强调色变量
├── js/
│   ├── state.js          全局状态、绩点换算表、scoreToGpa()、escapeHtml()、resizeImageToBase64()
│   ├── tabs.js            顶部快速跳转导航（锚点滚动 + 滚动高亮）
│   ├── profile.js         步骤01内：绩点制度/历史均绩/个人目标 的交互；
│   │                        课程增删、评分构成、hero 总览的渲染逻辑也在这个文件里
│   │                        （历史原因，虽然对应的 HTML 现在显示在步骤04）
│   ├── history.js         步骤01内：历史均绩（手动填写 + 拖拽图片导入 + 平均绩点汇总）
│   ├── ability.js         步骤02：学习能力自评（选填）+ AI 能力评估
│   ├── plan.js            步骤03：个性化选课建议（AI 生成）
│   ├── simulator.js       步骤04内：单科成绩模拟部分（滑块、实时计算）；课程录入和总览的
│   │                        HTML 显示在这一步，但逻辑仍在 profile.js 里（见上）
│   ├── matrix.js          步骤05：学习方案（按剩余权重×学分自动排优先级）
│   ├── ai.js              浏览器端调用各 /api/* 接口的封装
│   └── main.js            页面初始化入口，必须最后加载
├── api/
│   ├── course-advice.js         Vercel Serverless Function：生成个性化选课建议，Redis 做缓存
│   ├── ability-diagnosis.js     Vercel Serverless Function：生成能力与方向诊断，Redis 做缓存
│   ├── parse-grading-image.js   Vercel Serverless Function：识别截图里的评分构成
│   └── parse-transcript-image.js Vercel Serverless Function：识别截图里的历史课程成绩
├── package.json
├── .gitignore
└── README.md
```

## 页面流程（5 步，从上到下）

1. **绩点档案** —— 内部分三小块：
   1. 绩点制度（换算制式）
   2. 历史均绩（可选：拖拽成绩单截图导入 / 手动填写，会实时算出学分加权的历史平均绩点）
   3. 个人目标（本学期目标绩点、毕业/最终目标绩点都是**必填**；保研/奖学金/转专业/出国交换等其他要求选填）
2. **能力诊断** —— 整体选填：学习能力自评滑块（选填）+ AI能力评估（结合历史均绩和自评生成，历史均绩来自步骤01）
3. **个性化选课建议** —— 每周时间 / 优先目标 / 是否有实习竞赛，点按钮生成 AI 建议（会自动带上两个目标绩点和其他目标要求）
4. **成绩模拟计算器** —— 内部分三小块：
   1. 本学期课程 + 评分规则（含截图导入）
   2. 当前状态总览（自动生成）
   3. 单科成绩模拟（拖滑块看不同发挥下的总评和绩点）
5. **学习方案** —— 根据"成绩模拟计算器"里录入的课程自动算出的优先级排序，不需要额外点按钮

顶部的快速跳转导航和这 5 步一一对应，点了会平滑滚动过去，滚动的时候
也会自动高亮当前所在的步骤。

**注意**：本学期课程录入现在放在步骤04「成绩模拟计算器」里（不是步骤01），
因为"成绩模拟计算器"和步骤05「学习方案」都要靠这份课程数据算东西，
挪过去之后数据来源和使用它的功能挨得更近。

**必填校验**：点"生成 AI 个性化建议"时，前端和后端都会检查"本学期目标
绩点"和"毕业/最终目标绩点"是否都填了，没填会提示回去补，不会带着
空值硬调用模型。

## 用 GitHub Pages 直接预览（不含 AI 功能）

仓库根目录就是 `index.html`，推到 GitHub 后打开
`仓库 Settings → Pages → Source`，选 `Deploy from a branch`，
分支选 `main`，目录选 `/ (root)`，保存后几分钟内就能通过
`https://<你的用户名>.github.io/<仓库名>/` 访问。

**注意**：GitHub Pages 只能托管静态文件，不能跑 `api/` 目录里的
Serverless Function，所以在 GitHub Pages 上"生成 AI 个性化建议"这个
按钮会请求失败。AI 功能需要部署到 Vercel（见下面）。

## 部署到 Vercel（AI 功能需要这个）

1. 项目已经关联到 Vercel，Environment Variables 里需要有下面几个：

   | Key | 说明 |
   |---|---|
   | `UPSTASH_REDIS_REST_URL` | 已配置，用于缓存 AI 结果 |
   | `UPSTASH_REDIS_REST_TOKEN` | 已配置 |
   | `ANTHROPIC_API_KEY` | **还没配置，需要你自己去 [Anthropic Console](https://console.anthropic.com/settings/keys) 申请后添加** |
   | `ANTHROPIC_MODEL` | 可选，不填默认用 `claude-sonnet-5` |

   添加 `ANTHROPIC_API_KEY` 的位置：Vercel 项目 → Settings →
   Environment Variables → Add New，Key 填 `ANTHROPIC_API_KEY`，
   Value 填你的密钥，Environment 选 Production（如果本地也要测，
   Preview / Development 也勾上）。加完之后需要重新 Deploy 一次
   才会生效。

2. `api/course-advice.js` 和 `api/parse-grading-image.js` 都是标准的
   Vercel Node.js Serverless Function，`Application Preset` 保持你
   截图里的 `Other` 就行，Vercel 会自动识别 `api/` 目录下的文件，
   两个接口共用同一个 `ANTHROPIC_API_KEY`，不需要额外配置。

## 从截图导入评分规则

"绩点档案"模块里，评分构成表格上方有个"📷 从截图导入评分规则"按钮：

1. 选一张图片（课程大纲截图、老师发的评分说明截图都行）
2. 浏览器端先用 canvas 把图压缩到最长边 1400px 左右再上传，减少流量和识别时间
3. 后端 `api/parse-grading-image.js` 把图片发给 Claude 识别，返回
   `[{name, weight, score}]` 结构的数组
4. 前端拿到结果后会**清空当前的评分项表格，替换成识别出的内容**，
   识别失败或者认不出来的话表格不会被清空，会提示原因

识别结果不保证 100% 准确（尤其是手写或者拍摩尔纹很重的截图），
识别完之后务必自己核对一遍权重合计是不是 100%，再点"保存课程"。

## 历史成绩与能力诊断

"历史成绩"模块（大一新生可以直接跳过）支持两种录入方式，可以混用：

- **拖拽导入**：把成绩单/教务系统截图拖进那个虚线框，或者点击选择图片，
  支持一次选多张。每张图片都会调用 `api/parse-transcript-image.js`
  识别成 `{name, credit, score, tag}`（`tag` 是 AI 猜的课程类型，比如
  "数学""编程""写作"），识别出来的行会直接加到下面的表格里，不会覆盖
  已经手动填好的内容。
- **手动填写**：点"+ 添加一门历史课程"，自己填名称/学分/成绩/类型标签。

"AI 能力与方向诊断"模块把"历史成绩"表格里的内容 + "学习能力自评"
的五个滑块分数一起发给 `api/ability-diagnosis.js`，Claude 会结合两边
数据判断学生在哪类课程上相对更擅长。如果历史成绩是空的（新生）或者
样本很少，AI 会在 `dataNote` 里明确说明数据不足，不会硬编一个结论。

## 加载顺序

`index.html` 里的 `<script>` 标签顺序不能随便调换：

`state.js → tabs.js → profile.js → history.js → simulator.js → plan.js → matrix.js → ability.js → ai.js → main.js`

（脚本文件名和页面步骤编号不是一一对应的——`profile.js` 对应步骤01，
`history.js`/`ability.js` 一起对应步骤02，`plan.js` 对应步骤03，
`simulator.js` 对应步骤04，`matrix.js` 对应步骤05。脚本按依赖关系
加载，跟页面上步骤的展示顺序是两回事。）

原因：后面的文件里的函数会用到前面文件定义的全局变量（如 `courses`、`simAssumed`）
和函数（如 `scoreToGpa`），本项目没有用打包工具，靠加载顺序保证依赖关系。
`ai.js` 排在 `plan.js` / `profile.js` 后面也没关系，因为
`getAIAdvice()` 和 `getGradingItemsFromImage()` 都只在按钮点击 /
选择文件之后才会被调用，那时所有脚本早已加载完毕。

## AI 是怎么接入的

对应需求文档"7. Vibe Coding 的合理落点"的思路：

- **规则引擎（确定性计算）** 留在 `profile.js` / `simulator.js` / `matrix.js`
  里 —— 绩点换算、加权总评、目标反推、优先级排序，这些都不交给模型直接
  输出结果。
- **AI 负责"选课方案"这个更偏策略判断的部分**：`plan.js` 里点击
  "生成 AI 个性化建议"后，会把当前录入的课程、评分构成、目标绩点、
  每周可用时间打包发给 `/api/course-advice`。
- **AI 也负责"看图识别评分规则"**：`profile.js` 里选完截图后，会把
  压缩过的图片发给 `/api/parse-grading-image`，识别结果仍然是结构化
  数据，需要学生自己核对确认，不会跳过人工确认直接改动已保存的课程。
- 两个接口都在服务器端调用 Claude（`x-api-key` 只存在于
  服务器环境变量里，浏览器代码永远拿不到），要求模型只输出结构化 JSON
  （`summary` / `options` / `risks`），并且明确要求模型不要编造具体分数、
  数据不足时要说明而不是硬给结论。
- 相同的课程数据 + 目标短时间内重复请求时，会先查 Upstash Redis 缓存
  （1 小时过期），命中就直接返回，不重复调用模型。

## 本地预览

因为现在有真正的后端接口了，双击打开 `index.html` 没法测试 AI 功能
（浏览器直接打开本地文件时 `/api/course-advice` 请求不到）。本地调试
建议装 [Vercel CLI](https://vercel.com/docs/cli)，在项目目录跑：

```
vercel dev
```

它会本地起一个开发服务器，同时把 `api/` 目录识别成 Serverless
Function，环境变量会读取你在 Vercel 项目里配置的那一份（首次运行会
提示你登录并关联项目）。

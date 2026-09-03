# 学业罗盘 · 项目结构说明

```
.
├── index.html          页面结构（DOM），不含样式和逻辑
├── css/
│   └── style.css        全部样式，含浅蓝底色和五个模块的强调色变量
├── js/
│   ├── state.js          全局状态、绩点换算表、scoreToGpa()
│   ├── tabs.js            顶部快速跳转导航（锚点滚动 + 滚动高亮）
│   ├── profile.js         模块一：绩点档案（表单、课程卡片渲染、hero 数据同步）
│   ├── simulator.js       模块二：成绩模拟器（滑块、实时计算）
│   ├── plan.js            模块三：选课方案（AI 生成个性化建议）
│   ├── matrix.js          模块四：优先级矩阵
│   ├── ability.js         模块五：学习能力画像
│   ├── ai.js              浏览器端调用 /api/course-advice 的封装
│   └── main.js            页面初始化入口，必须最后加载
├── api/
│   ├── course-advice.js  Vercel Serverless Function：调用 Claude 生成建议，Redis 做缓存
│   └── parse-grading-image.js  Vercel Serverless Function：识别截图里的评分构成
├── package.json
├── .gitignore
└── README.md
```

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

## 加载顺序

`index.html` 里的 `<script>` 标签顺序不能随便调换：

`state.js → tabs.js → profile.js → simulator.js → plan.js → matrix.js → ability.js → ai.js → main.js`

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

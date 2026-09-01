# 学业罗盘 · 项目结构说明

```
.
├── index.html          页面结构（DOM），不含样式和逻辑
├── css/
│   └── style.css        全部样式，含浅蓝底色和五个模块的强调色变量
├── js/
│   ├── state.js          全局状态、绩点换算表、scoreToGpa()
│   ├── tabs.js            顶部 Tab 切换逻辑
│   ├── profile.js         模块一：绩点档案（表单、课程卡片渲染、hero 数据同步）
│   ├── simulator.js       模块二：成绩模拟器（滑块、实时计算）
│   ├── plan.js            模块三：选课方案卡片
│   ├── matrix.js          模块四：优先级矩阵
│   ├── ability.js         模块五：学习能力画像
│   ├── ai.js              AI 接入层占位，见下方说明
│   └── main.js            页面初始化入口，必须最后加载
├── .gitignore
└── README.md
```

## 用 GitHub Pages 直接预览

仓库根目录就是 `index.html`，推到 GitHub 后打开
`仓库 Settings → Pages → Source`，选 `Deploy from a branch`，
分支选 `main`，目录选 `/ (root)`，保存后几分钟内就能通过
`https://<你的用户名>.github.io/<仓库名>/` 访问，不需要任何构建步骤。

## 加载顺序

`index.html` 里的 `<script>` 标签顺序不能随便调换：

`state.js → tabs.js → profile.js → simulator.js → plan.js → matrix.js → ability.js → ai.js → main.js`

原因：后面的文件里的函数会用到前面文件定义的全局变量（如 `courses`、`simAssumed`）
和函数（如 `scoreToGpa`），本项目没有用打包工具，靠加载顺序保证依赖关系。

## 关于接入 AI

`js/ai.js` 是预留的接入层，对应需求文档"7. Vibe Coding 的合理落点"里的思路：

- **规则引擎（确定性计算）** 留在 `profile.js` / `simulator.js` / `matrix.js` 里，
  绩点换算、加权总评、目标反推、优先级排序都不应该交给大模型直接输出结果。
- **AI 只做"理解 + 生成 + 解释"**：解析自然语言评分规则、把计算结果转成
  通俗建议、生成能力画像的解释文字。AI 输出的结构化数据要经过学生确认，
  再交给规则引擎运算。

`ai.js` 里已经写好两个函数签名和调用位置说明：

- `parseGradingRuleWithAI(rawText)` —— 解析教师给的评分规则文字
- `explainResultWithAI(result)` —— 把模拟器算出的数字转成建议文案

目前这两个函数返回的是本地 mock 数据，方便先跑通交互。真正接入时：

1. 自己起一个后端接口（例如 `/api/ai/parse-grading-rule`），在后端调用
   Anthropic API 并注入密钥 —— **不要把 API Key 放进前端代码**。
2. 把 `ai.js` 里注释掉的 `fetch` 调用取消注释，指向你的后端地址。
3. 在 `profile.js` 里加一个文本框和按钮，调用 `parseGradingRuleWithAI()`，
   把返回的 `[{name, weight}]` 传给已有的 `addItemRow()` 函数即可。

## 本地预览

直接双击打开 `index.html` 即可（不依赖构建工具）。如果以后要接后端接口，
建议起一个本地静态服务器（如 `npx serve gpa-planner`），避免部分浏览器
对 `fetch` 请求的本地文件限制。

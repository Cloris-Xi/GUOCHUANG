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
│   ├── plan.js            步骤03：个性化选课建议（AI 生成，读取候选课程和冲突检测结果）
│   ├── candidates.js      步骤03内：候选课程（手动填写 + 拖拽图片导入 + 时间冲突检测）
│   ├── simulator.js       步骤04内：单科成绩模拟部分（滑块、实时计算）；课程录入和总览的
│   │                        HTML 显示在这一步，但逻辑仍在 profile.js 里（见上）
│   ├── matrix.js          步骤05：学习方案（AI 生成：优先级矩阵+目标可达性分析+四种方案）
│   ├── ai.js              浏览器端调用各 /api/* 接口的封装
│   ├── persistence.js     收集/恢复整页数据（collectAppState / applyAppState），供登录后保存/加载
│   ├── auth.js            登录/注册/忘记密码/重置密码的前端交互，页面加载时自动检查登录状态
│   └── main.js            页面初始化入口
├── lib/                  （不在 api/ 目录下，Vercel 不会把这里的文件当成路由，纯共享代码）
│   ├── redis.js           Upstash Redis REST API 的最小封装（get/set/del）
│   ├── auth.js            密码哈希、session 签发与校验、cookie 读写
│   └── email.js           用 Resend 发"忘记密码"邮件
├── api/
│   ├── course-advice.js         Vercel Serverless Function：生成个性化选课建议，Redis 做缓存
│   ├── study-plan.js            Vercel Serverless Function：生成学习方案（优先级矩阵+可达性分析+四种方案），Redis 做缓存
│   ├── parse-schedule-image.js  Vercel Serverless Function：识别选课系统截图里的课程/学分/时间
│   ├── ability-diagnosis.js     Vercel Serverless Function：生成能力与方向诊断，Redis 做缓存
│   ├── parse-grading-image.js   Vercel Serverless Function：识别截图里的评分构成
│   ├── parse-transcript-image.js Vercel Serverless Function：识别截图里的历史课程成绩
│   ├── user-data.js             GET/POST，登录后保存/读取整页数据（存 Redis，每次覆盖式保存）
│   └── auth/
│       ├── register.js          注册（bcrypt 哈希密码，自动登录）
│       ├── login.js             登录
│       ├── logout.js            登出（清 cookie）
│       ├── me.js                查询当前登录状态
│       ├── forgot-password.js   发送重置密码邮件（Resend）
│       └── reset-password.js    用邮件里的一次性 token 换新密码
├── package.json          （新增 bcryptjs 依赖，Vercel 部署时会自动 npm install）
├── .gitignore
└── README.md
```

## 登录功能需要额外配置的环境变量

除了之前已经配置的 `ANTHROPIC_API_KEY` 和 `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN`（登录功能直接复用同一个 Redis，账号数据和
AI 缓存数据用不同的 key 前缀区分，不会冲突），还需要新增两个：

| Key | 必需 | 说明 |
|---|---|---|
| `SESSION_SECRET` | 是 | 随便一串足够长、随机的字符串（比如用密码生成器生成 32 位），用来给登录状态的 cookie 签名。泄露了等于所有人的登录状态都能被伪造，只放在 Vercel 环境变量里，不要写进代码 |
| `RESEND_API_KEY` | 是（要用忘记密码功能就必须配） | 去 [resend.com](https://resend.com) 注册账号，在控制台申请一个 API Key |
| `RESEND_FROM` | 否 | 发件邮箱地址，不填默认用 Resend 提供的测试地址 `onboarding@resend.dev`（不需要自己验证域名就能发，但收件人邮箱里会看到 Resend 的痕迹）。正式使用建议在 Resend 后台验证自己的域名后，把这个改成你自己的邮箱，比如 `no-reply@yourdomain.com` |

添加方式和之前一样：Vercel 项目 → Settings → Environment Variables →
Add New，Environment 记得勾 Production，加完要重新 Deploy 一次才生效。

## 账号数据存在哪里、怎么组织的

- `user:<email>` —— 存 `{passwordHash, createdAt}`，密码永远只存 bcrypt
  哈希后的结果，不会有任何地方存明文密码。
- `userdata:<email>` —— 存整页数据的 JSON（本学期课程、历史均绩、
  个人目标、候选课程、能力自评、时间与优先目标偏好），点"保存我的
  数据"按钮时整份覆盖式保存，不是增量更新。
- `reset:<token>` —— 忘记密码时生成的一次性令牌，30 分钟过期，
  用一次就删，防止重放。

登录状态是一个签名 cookie（`gpa_session`），没有单独在 Redis 里存
session 记录——校验的时候用 `SESSION_SECRET` 重新算一遍签名对比，
省一次 Redis 读。cookie 有效期 30 天，登出就是把它清空。

**这是一个足够用的最小实现，不是银行级别的安全方案**：没做登录失败
次数限制（可能被暴力破解密码）、没做邮箱验证（注册时不会发确认邮件，
任何人可以用任意邮箱注册，包括别人的邮箱——只是他们收不到那个邮箱的
邮件而已，不影响你自己账号的安全）。如果之后要接入正式的多用户产品，
建议换成 Auth0 / Clerk / NextAuth 这类专门的认证服务，而不是继续在
这个自建方案上加功能。



1. **绩点档案** —— 内部分三小块：
   1. 绩点制度（换算制式）
   2. 历史均绩（可选：拖拽成绩单截图导入 / 手动填写，会实时算出学分加权的历史平均绩点）
   3. 个人目标（本学期目标绩点、毕业/最终目标绩点都是**必填**；保研/奖学金/转专业/出国交换等其他要求选填）
2. **能力诊断** —— 整体选填：学习能力自评滑块（选填）+ AI能力评估（结合历史均绩和自评生成，历史均绩来自步骤01）
3. **个性化选课建议** —— 内部分两小块：
   1. 候选课程（已有专业课 + 想选的选修课，拖拽选课系统截图导入 / 手动填写，需要学分和上课时间，前端会自动查时间冲突）
   2. 时间与目标偏好（每周时间 / 优先目标 / 是否有实习竞赛）

   点按钮生成 AI 建议时会带上候选课程清单、冲突检测结果、两个目标绩点和其他目标要求
4. **成绩模拟计算器** —— 内部分三小块：
   1. 本学期课程 + 评分规则（含截图导入）
   2. 当前状态总览（自动生成）
   3. 单科成绩模拟（拖滑块看不同发挥下的总评和绩点）
5. **学习方案** —— 点"生成学习方案"，AI 结合前面所有步骤的数据生成三段式结果：
   - A. 优先级矩阵：每门课在 GPA影响/截止风险/提分潜力/时间成本 四个维度打标签，给出 P0-P3 建议优先级
   - B. 目标可达性分析：结合每周可用时间判断达标概率（较低/中等/较高），给调整建议
   - C. 学习方案：稳健方案/冲刺方案/时间受限方案/风险控制方案，四个固定命名的取舍方案

顶部的快速跳转导航和这 5 步一一对应，点了会平滑滚动过去，滚动的时候
也会自动高亮当前所在的步骤。

**注意**：本学期课程录入现在放在步骤04「成绩模拟计算器」里（不是步骤01），
因为"成绩模拟计算器"和步骤05「学习方案」都要靠这份课程数据算东西，
挪过去之后数据来源和使用它的功能挨得更近。「学习方案」现在是点按钮生成，
不再是页面一加载就自动算好的静态表格——因为"提分潜力""截止风险"这些
判断需要综合权衡，比单纯按权重排序更适合交给 AI。

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

## 候选课程与时间冲突检测

"个性化选课建议"步骤里的"候选课程"支持和历史成绩一样的两种录入方式
（拖拽选课系统截图 / 手动填写），多了一个"必修/选修"下拉和"上课时间"
输入框。上课时间要求按固定格式填，比如：

```
周二 3-4节；周四 1-2节
```

`js/candidates.js` 里的 `parseTimeSlots()` 按这个格式解析成
`{day, start, end}`，`findConflicts()` 两两比较候选课程列表，纯前端
算出有没有同一天、节次有重叠的课，不需要调用 AI——这是一次性能算准的
确定性问题，交给规则引擎比交给大模型更可靠。冲突检测结果会实时显示
在候选课程列表下面，也会打包进发给 `api/course-advice.js` 的请求里，
让 AI 在生成建议的时候看到具体是哪些课冲突。

拖拽导入这部分调用的是新接口 `api/parse-schedule-image.js`，识别
课程名称、学分、必修/选修、上课时间，同样要求模型输出上面那种固定
时间格式，方便前端解析——如果截图里的时间是具体时刻（比如
"10:00-11:40"）而不是"第几节"，模型会尽量转换成最接近的节次，
转换不准的话需要手动改一下"上课时间"这一栏。

## 登录与数据保存

页面顶部有个登录栏。没登录时显示"登录 / 注册"两个按钮，登录后显示
当前邮箱、"保存我的数据"和"退出登录"。

**保存/恢复的范围**：本学期课程、历史均绩、个人目标（两个目标绩点+
其他目标要求）、候选课程、能力自评、时间与优先目标偏好——也就是
"绩点档案""能力诊断""个性化选课建议"三步里所有的输入内容。AI 生成
出来的结果（能力诊断、选课建议、学习方案）不会被保存，因为那些本来
就是基于当前数据现算的，重新点一下按钮就能再生成一份。

**怎么用**：
1. 右上角点"注册"，填邮箱和密码（至少 8 位）创建账号，会自动登录
2. 正常填页面上的各项内容
3. 填完点"保存我的数据"，存到服务器
4. 下次打开页面（同一账号登录后）会自动读回来，所有输入框都会
   重新填上之前保存的内容

**忘记密码**：登录弹窗里点"忘记密码了"，输入邮箱，收一封带重置链接
的邮件（30 分钟内有效，用一次就失效），点链接会自动弹出"设置新密码"
的表单。

**没有做自动保存**——每次改动就存一次请求太频繁，改成用户自己点
"保存我的数据"的时候才存一整份，逻辑更简单也更可控。

## 加载顺序

`index.html` 里的 `<script>` 标签顺序不能随便调换：

`state.js → tabs.js → profile.js → history.js → candidates.js → simulator.js → plan.js → matrix.js → ability.js → ai.js → main.js → persistence.js → auth.js`

`persistence.js` 和 `auth.js` 必须放在所有功能模块之后——`auth.js`
一加载就会自动检查登录状态，如果已登录会立刻尝试加载保存过的数据并
回填到页面各处（`addHistoryRow`、`addCandidateRow`、`renderCourses`
这些函数都必须已经定义好）。

（脚本文件名和页面步骤编号不是一一对应的——`profile.js` 对应步骤01，
`ability.js` 对应步骤02，`plan.js`/`candidates.js` 对应步骤03，
`simulator.js` 对应步骤04，`matrix.js` 对应步骤05，`history.js` 虽然
文件名像独立步骤，其实对应的是步骤01里的"历史均绩"子模块。`persistence.js`
和 `auth.js` 不对应任何一个步骤，是贯穿全页面的登录/保存功能。脚本按
依赖关系加载，跟页面上步骤的展示顺序是两回事。）

原因：后面的文件里的函数会用到前面文件定义的全局变量（如 `courses`、`simAssumed`）
和函数（如 `scoreToGpa`），本项目没有用打包工具，靠加载顺序保证依赖关系。
`ai.js` 排在 `plan.js` / `profile.js` 后面也没关系，因为
`getAIAdvice()` 和 `getGradingItemsFromImage()` 都只在按钮点击 /
选择文件之后才会被调用，那时所有脚本早已加载完毕。

## AI 是怎么接入的

对应需求文档"7. Vibe Coding 的合理落点"的思路：

- **规则引擎（确定性计算）** 留在 `profile.js` / `simulator.js`
  里 —— 绩点换算、加权总评、目标反推，这些都不交给模型直接输出结果；
  `candidates.js` 里的时间冲突检测也是纯规则计算，不调用 AI。
- **AI 负责"选课方案"这个更偏策略判断的部分**：`plan.js` 里点击
  "生成 AI 个性化建议"后，会把当前录入的课程、候选课程、冲突检测结果、
  目标绩点、每周可用时间打包发给 `/api/course-advice`。
- **AI 也负责"学习方案"这个需要综合权衡的部分**：`matrix.js` 里点击
  "生成学习方案"后，会把课程的剩余权重/当前加权分、候选课程冲突、
  两个目标绩点等打包发给 `/api/study-plan`，生成优先级矩阵、目标可达性
  分析、四种固定命名的取舍方案——这几个判断（比如"提分潜力""截止风险"）
  需要综合权衡多个因素，比单纯按权重排序更适合交给 AI，但仍然要求
  模型只从"四选一"的固定选项里挑（高/中/低，P0-P3），不能自由发挥。
- **AI 也负责"看图识别"**：`profile.js`/`history.js`/`candidates.js`
  里选完截图后，会把压缩过的图片分别发给 `/api/parse-grading-image`、
  `/api/parse-transcript-image`、`/api/parse-schedule-image`，识别结果
  仍然是结构化数据，需要学生自己核对确认，不会跳过人工确认直接改动
  已保存的内容。
- 所有接口都在服务器端调用 Claude（`x-api-key` 只存在于
  服务器环境变量里，浏览器代码永远拿不到），要求模型只输出结构化 JSON，
  并且明确要求模型不要编造具体分数或日期，数据不足时要说明而不是硬给结论。
- 相同的输入数据短时间内重复请求时，`course-advice` / `ability-diagnosis`
  / `study-plan` 三个接口都会先查 Upstash Redis 缓存，命中就直接返回，
  不重复调用模型。

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

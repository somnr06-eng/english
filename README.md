# English Dictation Pro

Cloudflare Workers + 静态资产 + D1 实现的英语听写应用。

当前版本支持：
- 多学生账号登录
- 每个学生独立错题库
- 每天每个学习日只允许完成一次
- 听写结果逐词保存
- 复习词优先从该学生错题库中抽取，拼对后自动移出错题库

## 项目结构

- `public/index.html`: 登录页
- `public/home.html`: 听写主页
- `worker.js`: Worker 路由入口
- `functions/api/login.js`: 学生登录
- `functions/api/session.js`: 登录态查询
- `functions/api/logout.js`: 退出登录
- `functions/api/dictation/session.js`: 查询今天某个学习日是否已完成
- `functions/api/dictation/quiz.js`: 生成当天题集
- `functions/api/dictation/submit.js`: 提交听写结果并同步错题库
- `functions/api/_utils.js`: 公共工具
- `schema.sql`: D1 表结构
- `seed.sql`: 本地测试学生数据
- `wrangler.toml`: Cloudflare 配置

## D1 数据模型

- `students`: 学生账号
- `dictation_attempts`: 每次听写主记录
- `dictation_attempt_items`: 每个单词的作答明细
- `student_wrong_words`: 每个学生的错题库

## 本地开发

1. 准备本地环境变量

复制 `.dev.vars.example` 为 `.dev.vars`，并填写：

```env
SESSION_SECRET=your-local-secret
```

2. 初始化本地 D1 数据库

```bash
npx wrangler d1 execute english-dictation-pro --local --file=schema.sql
npx wrangler d1 execute english-dictation-pro --local --file=seed.sql
```

3. 启动本地服务

```bash
npx wrangler dev --port 8788
```

4. 打开浏览器

- `http://localhost:8788`

本地测试账号：

- `test001 / 123456`
- `test002 / abc123456`

## 复习逻辑

- 当天新词固定为该 day 的新单词
- 复习题优先从当前学生错题库中随机抽取，最多 20 个
- 若错题库不足 20 个，则从之前学习日的其他单词中随机补足
- 如果某个错题在本次听写中拼写正确，则从该学生错题库中移除
- 如果再次拼错，则保留在错题库中，并累加错误次数

## 部署到 Cloudflare Workers

静态页面位于 `public/` 目录，Worker 会通过 `ASSETS` 绑定来提供这些资源。

1. 推送代码到 Git 仓库
2. 在 Cloudflare Dashboard 连接 Pages 项目
3. 创建并绑定 D1 数据库
4. 在项目中执行 `schema.sql`
5. 导入学生账号数据
6. 配置 `SESSION_SECRET`
7. 部署

## 生产环境初始化建议

生产环境也需要先执行表结构初始化：

```bash
npx wrangler d1 execute english-dictation-pro --file=schema.sql
```

如果你之前已经初始化过旧版本表结构，也需要重新执行一次最新的 `schema.sql`，因为当前版本新增了 `student_sessions` 表，并且给 `student_wrong_words` 增加了状态字段。

学生账号建议提前生成 SHA-256 Base64URL 密码摘要后写入 `students.password_hash`。

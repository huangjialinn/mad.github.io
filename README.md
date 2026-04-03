# MAD 内部娱乐网站

## 1. 直接使用
- 入口文件：`index.html`
- 样式文件：`styles.css`
- 逻辑文件：`app.js`
- 数据文件：`data/mad-data.json`

## 2. 可修改接口
在 `app.js` 顶部 `APP_CONFIG` 内可修改：
- `siteTitle`：网页名（默认 `MAD`）
- `siteTagline`：副标题
- `members`：8 位成员的 `name / avatar / password`
- `githubDefaults`：默认 GitHub 仓库信息

## 3. 权限规则
- 成员登录（8 位成员 + 密码）后可新增/删除内容
- 访客只读，可查看所有内容但不能修改

## 4. 数据读取与保存
- 页面加载时读取 `data/mad-data.json` 并展示
- 成员编辑后，点击“同步到 GitHub”可通过 GitHub API 提交 JSON
- 下一次进入页面会读取该 JSON 的最新内容

## 5. GitHub 同步配置
在页面“GitHub Pages 持久化”区域填写：
- `Owner`
- `Repo`
- `Branch`
- `Data Path`（默认 `data/mad-data.json`）
- `Token`（Personal Access Token，需有对应仓库写权限）

说明：
- Token 仅在当前页面内使用，不写入仓库文件
- 若未同步到 GitHub，数据仍会保存在浏览器本地草稿（localStorage）

## 6. 功能清单
- 事件记录日历
  - 喝酒记录：地点 + 参与成员 + 最多 1 图
  - 吃饭记录：地点 + 参与成员 + Y其林评分（-3~3）+ 最多 9 图
  - 群体运动记录：活动 + 运动时间 + 参与成员
- 成员光荣榜（糗事）：成员 + 内容 + 最多 9 图
- 成员宠物展示：成员 + 宠物名 + 年龄 + 最多 9 图（每成员可多只）
- 更新日志：自动记录新增/删除动作

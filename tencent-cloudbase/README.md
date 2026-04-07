# 腾讯云 CloudBase 多端同步

## 1. 创建环境
在腾讯云控制台打开「云开发 CloudBase」，创建环境（免费版即可）。

## 2. 创建数据库集合
在「数据库」中新建集合：`mad_data`

## 3. 部署云函数
在「云函数」中新建函数（Node.js），函数名建议 `mad-data`。
把 `tencent-cloudbase/function/mad-data/index.js` 的内容粘贴进去。

然后：
1. 设置环境变量 `ADMIN_PASSWORD`，值与你前端管理密码一致（如 `2026`）。
2. 启用 HTTP 访问，记录函数 URL（例如：`https://xxxx-yyy.service.tcloudbase.com/mad-data`）。

## 4. 前端配置
在 `app.js` 的 `APP_CONFIG.persistence.cloudApiBase` 填上函数 URL。

示例：
```js
cloudApiBase: "https://xxxx-yyy.service.tcloudbase.com/mad-data",
```

## 5. 使用方式
1. 访问网页，进入管理模式。
2. 新增/删除后会自动同步到云端。
3. 其他设备刷新即可看到最新数据。

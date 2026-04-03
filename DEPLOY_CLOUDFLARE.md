# Cloudflare Worker 部署步骤

1. 安装 Wrangler
```bash
npm i -g wrangler
```

2. 登录 Cloudflare
```bash
wrangler login
```

3. 创建 KV namespace
```bash
wrangler kv namespace create MAD_DATA_KV
```

4. 进入 `cloudflare-worker` 目录，复制配置文件
```bash
cd cloudflare-worker
copy wrangler.toml.example wrangler.toml
```
把 `wrangler.toml` 里的 `id` 替换成第 3 步返回的 namespace id。

5. 设置管理密码（和网页管理密码保持一致）
```bash
wrangler secret put ADMIN_PASSWORD
```

6. 发布 Worker
```bash
wrangler deploy
```

7. 在网页里配置
- 打开页面 -> `云端持久化`
- `API Endpoint` 填 Worker URL（例如 `https://mad-data-worker.xxx.workers.dev`）
- 点 `保存配置`
- 进入管理模式新增一条内容，确认状态显示同步成功


# 第 5 阶段：管理运维、部署与更新策略

## 目标

让工作人员能查看系统运行状态，让管理员能创建数据备份，并提供可重复、可审计的服务器部署与 GitHub 更新流程。

## 管理后台

`admin/operations.html` 是独立的系统运维页面：

- `staff/admin` 可查看服务、数据库、地图数据和备份状态。
- 只有 `admin` 可从网页创建备份。
- 备份包含正式 `data/areas` 和 SQLite 数据库快照；默认保存在应用数据目录，不进入 Git。
- 网页不会执行 Git 命令、重启服务或修改服务器环境变量。

## 健康检查

- `/api/v1/health`：存活检查，说明进程能响应。
- `/api/v1/health/ready`：就绪检查，同时验证数据库和地图区域索引。
- 容器健康检查和监控平台应使用就绪接口。

## GitHub 更新策略

服务器管理员运行 `.\scripts\update-from-github.ps1`，或双击 `更新服务器版本.cmd`。脚本会：

1. 确认当前分支是 `master` 且工作区干净。
2. 创建地图与数据库备份。
3. 获取 `origin/master`，仅允许 fast-forward 更新。
4. 执行数据库迁移和完整检查。
5. 提示管理员重启服务。

脚本不会强制覆盖本地文件、切换分支或自动回滚。检查失败时应保留现场，使用备份恢复数据并由管理员处理代码版本。

## Docker 与域名部署

1. 准备一台安装 Docker 的 Linux 服务器。
2. 将域名的 `A/AAAA` 记录指向服务器公网地址。
3. 复制 `.env.production.example` 为 `.env.production`，设置强随机 `NJU_JWT_SECRET`、真实域名和允许来源。
4. 开放服务器的 `80`、`443` 端口。
5. 运行 `docker compose up -d --build`。

`Caddy` 会依据 `NJU_DOMAIN` 自动申请和续期 HTTPS 证书，并把请求转发到 FastAPI。应用数据库和备份保存在 Docker volume `app-runtime` 中。

## 生产建议

- 小规模单实例可使用当前 SQLite；多实例部署应改用 PostgreSQL。
- 每日自动创建备份，并将备份复制到服务器外的对象存储。
- 对 `/api/v1/health/ready` 配置一分钟一次的可用性监控与告警。
- 定期测试备份恢复，而不只是确认备份文件存在。
- GitHub 仓库使用受保护的 `master` 分支，更新服务器使用只读部署密钥。

## 验收标准

1. 运维页面按角色展示状态与备份能力。
2. 就绪接口能检查数据库和地图数据。
3. 备份包含地图区域和数据库快照，且不进入 Git。
4. Docker、Caddy、环境变量和域名流程有明确文档。
5. GitHub 更新只允许干净的 `master` 快进更新。
6. `npm.cmd run check` 与 `npm.cmd run db:upgrade` 通过。
7. 阶段提交推送至 GitHub `master`。

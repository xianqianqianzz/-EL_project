# 第 2 阶段：账号、权限与数据库基础

## 目标

为后续行程和修改申请提供可靠的用户身份、权限判断和可迁移数据库。

## 本阶段交付

- SQLite 本地数据库与 SQLAlchemy 2.0 数据模型。
- Alembic 初始迁移。
- 用户注册、登录、读取当前账号和退出登录。
- Argon2 密码哈希，数据库不保存明文密码。
- 带有效期的 JWT access token。
- `user`、`staff`、`admin` 三种角色与可复用权限依赖。
- 登录/注册前端对话框。
- 认证与权限自动测试。

## 安全边界

- 公开注册只能创建 `user`，不能自行获得 `staff` 或 `admin`。
- JWT 只保存用户 ID；每次受保护请求都会重新查询用户状态与角色。
- 浏览器 token 仅存于 `sessionStorage`，关闭会话后自动清除。
- 默认数据库位于当前用户的本地应用数据目录，数据库文件和 `.env` 不进入 Git。
- 部署前必须修改 `NJU_JWT_SECRET`，并通过 HTTPS 提供服务。

## 本阶段不做

- 不实现行程、提醒或路线修改申请。
- 不实现管理后台、角色编辑接口或一键 GitHub 更新。
- 不实现邮箱验证、密码找回、refresh token 或第三方登录。

## 本地使用

```powershell
python -m pip install -r backend/requirements-dev.txt
npm.cmd run db:upgrade
npm.cmd run dev
```

修改数据库结构时，应新增 Alembic 迁移，不得直接改动现有生产数据库。

## 验收标准

1. 新用户可在网页注册、登录、查看账号状态并退出。
2. 重复用户名或邮箱、错误密码和无效 token 会被拒绝。
3. 普通用户无法通过公开接口获得高权限角色。
4. `npm.cmd run check` 和 `npm.cmd run db:upgrade` 通过。
5. 阶段提交已推送 GitHub `master`。

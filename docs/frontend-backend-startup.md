# 前后端分离启动说明

项目开发时，前端与后端分别运行：

## 后端

双击 `scripts/start-backend.cmd`，或在 PowerShell 中运行：

```powershell
.\scripts\start-backend.ps1
```

后端地址：`http://localhost:8000`
接口文档：`http://localhost:8000/docs`

## 前端

双击 `scripts/start-frontend.cmd`，或在另一个 PowerShell 窗口中运行：

```powershell
.\scripts\start-frontend.ps1
```

前端地址：`http://localhost:8080`，默认进入登录页面。

## 一键启动并打开

双击项目根目录中的 `一键打开校园地图.exe`。程序会：

1. 检查并启动后端。
2. 检查并启动前端。
3. 自动使用默认浏览器打开后端同源登录页面 `http://localhost:8000/`。

若 `.exe` 无法使用，也可以双击 `一键打开校园地图.cmd`。

## 页面权限

- `index.html`：默认登录与注册页。登录成功后自动进入地图主页。
- `map.html`：地图主页。游客可以直接访问并规划路线。
- `login.html`：兼容旧链接，自动跳转至默认登录页。
- `schedule.html`：独立个人日程页。未登录访问时自动跳转登录页。
- 地图规划地点间路线后，可点击“用这条路线创建日程”，自动带入日程表单的起点与终点。
- `admin/`：工作人员与管理员后台，按内容拆分为多个页面。
- 管理后台每个页面提供“返回主网站”；用户详情会列出关联的 `日程 #ID` 和 `申请 #ID`，并可跳转到对应编号查询页。
- 首次登录且账号没有日程时，后端自动创建三条示例日程。

前端通过 `js/config.js` 中的 `CONFIG.apiBase` 访问后端。部署时应将该值改为正式 API 地址，并同步配置后端允许的前端来源。

当前配置在 `8080` 开发前端下访问本地 `8000` API；由 FastAPI 或生产域名同源托管时自动使用当前域名，无需手工写死生产 API 地址。

若在 `8080` 登录时看到“无法连接后端服务”或 `Failed to fetch`，通常是浏览器拦截了跨端口请求。请改用 `http://localhost:8000/`。

生产部署、HTTPS 域名、备份与服务器更新见 [第 5 阶段说明](phase-5-operations-deployment.md)。

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

前端地址：`http://localhost:8080`

## 页面权限

- `index.html`：地图主页。游客可以查看地图并规划路线。
- `login.html`：独立登录与注册页。登录成功后自动进入地图主页。
- `schedule.html`：独立个人日程页。未登录访问时自动跳转登录页。
- 首次登录且账号没有日程时，后端自动创建三条示例日程。

前端通过 `js/config.js` 中的 `CONFIG.apiBase` 访问后端。部署时应将该值改为正式 API 地址，并同步配置后端允许的前端来源。

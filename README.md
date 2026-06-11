# 南京大学校园地图

项目使用“一个区域文件夹对应一张地图图片和一个 `area.json`”的数据形式。当前演示区域为仙林校区室外总图。

## 首次安装

项目当前使用原生 HTML/CSS/JavaScript + Leaflet 前端，以及 FastAPI 后端。安装后端开发依赖：

```powershell
python -m pip install -r backend/requirements-dev.txt
```

## 推荐启动方式

在项目根目录运行：

```powershell
npm.cmd run dev
```

打开 `http://localhost:8000/`。后端会托管现有地图前端，并通过 `/api/v1` 提供区域数据接口；接口调试页面位于 `http://localhost:8000/docs`。

首次启动或数据库结构更新后，运行迁移：

```powershell
npm.cmd run db:upgrade
```

复制 [.env.example](.env.example) 中需要的设置到本地 `.env`。部署前必须替换 `NJU_JWT_SECRET`；`.env` 和数据库运行文件不会进入 Git。Windows 默认数据库位于 `%LOCALAPPDATA%\nju-campus-map\app.db`，可通过 `NJU_DATABASE_URL` 改为 PostgreSQL 等正式数据库。

## 纯前端应急启动

在项目根目录启动静态服务器：

```powershell
python -m http.server 8080
```

打开 `http://localhost:8080/index.html`。标注工具位于 `http://localhost:8080/tools/path-editor.html`。此模式没有后端 API，前端会自动回退到静态区域文件。

网站加载区域 JSON 时会主动绕过浏览器缓存。更新 `area.json` 后刷新页面即可看到最新地点和节点；普通路网节点仅在点击“选择起点/终点”后显示。

运行数据校验：

```powershell
npm run validate:data
```

提交或创建 Pull Request 前运行完整基线检查：

```powershell
npm run check
```

GitHub Actions 会对 Pull Request 和正式分支推送执行同一套检查。检查命令现在也包含后端 API 测试。

阶段说明与接口规范：

- [第 0 阶段基线](docs/phase-0-baseline.md)
- [第 1 阶段全栈基础](docs/phase-1-foundation.md)
- [第 2 阶段账号、权限与数据库基础](docs/phase-2-auth-database.md)
- [API 接口契约](docs/api-contract.md)
- [阶段路线图](docs/staged-roadmap.md)

## 当前数据

```text
data/
└─ areas/
   ├─ index.json
   └─ outdoor-xianlin/
      ├─ map.png
      └─ area.json
```

- `map.png` 是该区域唯一的标注底图。
- `area.json` 同时保存地点、路网节点和边。
- 所有坐标都是底图原始尺寸上的图片像素坐标，不使用经纬度。
- `place` 是用户可搜索地点，必须绑定一个 `routeNodeId`。
- `node` 只是路网节点，不需要标签。
- `edge` 连接两个节点，不保存自由折线。
- 网站默认常驻显示 `place` 圆点，地点名称在悬停时显示；普通 `node` 仅在“选择起点/终点”模式中显示。
- `area.json` 仍是地图数据的唯一正式来源；后端 API 只读取并发布它，不复制数据。

详细规范见 [docs/data-format.md](docs/data-format.md) 和 [docs/path-data-workflow.md](docs/path-data-workflow.md)。

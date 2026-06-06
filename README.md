# 南京大学仙林校区智能地图

这是一个面向南京大学仙林校区的静态地图网站项目，目标是支持两层导航：

1. 总地图层：在大型建筑物和重要室外目标之间规划步行路线。
2. 建筑室内层：进入建筑后，以房间、厕所、服务台等室内目标为单位规划路线。

项目重点不再是收集大量零散设施点，而是建立可靠的可通行路径网络，让路线沿真实道路和走廊行走。

## 技术栈

| 模块 | 选择 |
|------|------|
| 前端 | HTML / CSS / 原生 JavaScript |
| 室外地图 | Leaflet.js 1.9.4 |
| 室内地图 | Canvas API |
| 路径规划 | 自实现 Graph + A* |
| 数据 | 静态 JSON 文件 |
| 数据校验 | Node.js 脚本 |

初期继续使用原生 JS，避免四人小组在框架学习上消耗过多时间。若初期检查后需要增强 UI，可优先只重构 UI 层，地图、数据和寻路模块继续复用。

## 快速开始

在项目根目录启动一个本地 HTTP 服务：

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080/index.html
```

当前 Leaflet 通过 CDN 加载。演示前请提前打开页面确认底图能显示；若演示环境网络不稳定，应下载 Leaflet 1.9.4 到 `lib/leaflet/` 并同步修改 `index.html` 的引用。

地图节点与边标注工具访问：

```text
http://localhost:8080/tools/path-editor.html
```

修改数据后运行：

```bash
npm.cmd run validate:data
```

## 项目结构

```text
nju-campus-map/
├── index.html
├── css/
├── js/
│   ├── app.js                  # 应用入口和模块协调
│   ├── config.js               # 全局配置
│   ├── data/                   # 数据加载和浏览器侧校验
│   ├── map/                    # 室外 Leaflet 与室内 Canvas 渲染
│   ├── nav/                    # Graph、A*、路径构建和渲染
│   └── ui/                     # 搜索和信息面板
├── data/
│   ├── areas/
│   │   ├── index.json
│   │   └── outdoor-xianlin/
│   │       ├── map.png
│   │       └── area.json       # 该区域唯一数据文件
├── docs/
├── scripts/
│   └── validate-data.js
└── tools/
    └── path-editor.html        # 图片节点与边标注工具
```

## 数据模型

### 总地图层

总地图只保留用户会直接搜索和导航的重要目标：

- 所有区域均在 `data/areas/index.json` 注册
- 仙林室外区域：来自 `data/areas/outdoor-xianlin/area.json`
- 校门、公交/地铁、食堂、停车场、广场等室外目标：来自区域 JSON 的 `places`
- 可通行路线：由区域 JSON 的无标签 `nodes` 和端点 `edges` 组成
- 室外地点和路线统一使用 `map.png` 的 `x/y` 像素坐标，不使用经纬度

饮水机、楼内厕所、单个教室、自习室、楼内 ATM 等细节不得放入总地图目标文件。

网站的底图、可搜索地点和路径规划均以 `data/areas/index.json` 注册的 `area.json` 为唯一来源。一个区域文件夹只保留一张 `map.png` 和一个 `area.json`，不再维护旧式混合数据文件。

网站选择起终点时，先点击对应输入框旁的“选择起点”或“选择终点”按钮。进入选择状态后，地图会显示该区域全部可选路网节点；点击节点或已标注地点即可完成选择。

### 建筑室内层

室内区域也必须建立 `data/areas/<area-id>/area.json`，并在 `data/areas/index.json` 中注册。室内以房间或设施为目标，路径应连接到门口、走廊、楼梯或电梯节点。

室内可搜索目标类型：

- `room`：教室、办公室、阅览区、会议室等
- `facility`：厕所、服务台、饮水点等室内设施

走廊、楼梯、电梯、入口只参与寻路，默认不作为普通搜索结果。

## 路径数据流程

路径规划最难的部分是从地图图片中获得“人能走的线”。本项目采用人机协作流程：

1. D 组收集室外地图和楼层平面图。
2. 每个区域建立一个文件夹，例如 `data/areas/outdoor-xianlin/`。
3. 区域文件夹中只保留一张标注底图 `map.png`。
4. D 组使用 `tools/path-editor.html` 标注 `place`、无标签 `node`，再点击两个节点创建可通行 `edge`。
5. 标注工具直接导出可运行的像素坐标 `area.json`。
6. B 组运行 `npm.cmd run validate:data` 检查断边、重复 ID、不可达路线和审核状态。
7. A 组按 A* 返回的连续节点坐标渲染路线。
8. 四人共同审核示例路线，确认不穿墙、不乱绕、不走不可通行区域。

详见：

- `docs/path-data-format.md`
- `docs/path-data-workflow.md`
- `docs/member-guides.md`

## 四人分工

| 角色 | 主要范围 | 目录 |
|------|----------|------|
| A 地图渲染 | 室外地图、室内 Canvas、节点连线显示、标注工具维护 | `js/map/`, `tools/` |
| B 路径规划 | Graph、A*、边权、数据校验、路线测试 | `js/nav/`, `scripts/` |
| C UI 交互 | 搜索、路线说明、信息面板、错误提示 | `js/ui/`, `css/` |
| D 数据文档 | 图片整理、路径标注、JSON 数据、说明文档 | `data/`, `docs/` |

## 关键文档

| 文档 | 用途 |
|------|------|
| `docs/architecture.md` | 系统架构和模块接口 |
| `docs/data-format.md` | 正式数据文件格式 |
| `docs/path-data-format.md` | 路径网络和标注导出格式 |
| `docs/path-data-workflow.md` | 图片到路径数据的人机合作流程 |
| `docs/member-guides.md` | 四名组员的详细操作指南 |
| `docs/checkpoint-checklist.md` | 中期检查自查清单 |
| `docs/github-guide.md` | GitHub 协作流程 |

## 当前校验重点

`npm.cmd run validate:data` 会检查：

- JSON 能否读取
- 各类 `id` 是否唯一
- 室外目标 `routeNodeId` 是否能接入 Graph
- 默认室外区域 `area.json` 的节点、边和审核状态是否有效
- 索引内每个区域是否存在且符合统一格式
- 示例路线是否可达

如果出现“致命问题”，不要合并数据。若只有 `draft` 或单向 `connections` 建议，可以先记录为后续修正任务，但演示主路线应尽量达到 `reviewed`。

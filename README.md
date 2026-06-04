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

路径标注工具访问：

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
│   └── ui/                     # 搜索、信息面板、标记弹窗
├── data/
│   ├── buildings.json          # 建筑物目标
│   ├── outdoor-targets.json    # 非建筑的重要室外目标
│   ├── outdoor-nodes.json      # 兼容旧寻路节点和连接
│   ├── outdoor-paths.json      # 真实室外可通行折线网络
│   └── indoor/                 # 各建筑室内数据
├── docs/
├── scripts/
│   └── validate-data.js
└── tools/
    └── path-editor.html        # 图片路径标注工具
```

## 数据模型

### 总地图层

总地图只保留用户会直接搜索和导航的重要目标：

- 大型建筑物：来自 `data/buildings.json`
- 校门、公交/地铁、食堂、停车场、广场等室外目标：来自 `data/outdoor-targets.json`
- 可通行路线折线：来自 `data/outdoor-paths.json`

饮水机、楼内厕所、单个教室、自习室、楼内 ATM 等细节不得放入总地图目标文件。

### 建筑室内层

室内数据位于 `data/indoor/<building-id>.json`。室内以房间或设施为目标，路径应连接到门口、走廊、楼梯或电梯节点。

室内可搜索目标类型：

- `room`：教室、办公室、阅览区、会议室等
- `facility`：厕所、服务台、饮水点等室内设施

走廊、楼梯、电梯、入口只参与寻路，默认不作为普通搜索结果。

## 路径数据流程

路径规划最难的部分是从地图图片中获得“人能走的线”。本项目采用人机协作流程：

1. D 组收集室外地图和楼层平面图。
2. D 组使用 `tools/path-editor.html` 在图片上标注节点和可通行边。
3. AI 或 B 组把导出的像素坐标标注转换为正式 JSON。
4. B 组运行 `npm.cmd run validate:data` 检查断边、重复 ID、不可达路线和审核状态。
5. A 组在地图上按 `edge.path` 渲染真实折线。
6. 四人共同审核示例路线，确认不穿墙、不乱绕、不走不可通行区域。

详见：

- `docs/path-data-format.md`
- `docs/path-data-workflow.md`
- `docs/member-guides.md`

## 四人分工

| 角色 | 主要范围 | 目录 |
|------|----------|------|
| A 地图渲染 | 室外地图、室内 Canvas、路径折线显示、标注工具维护 | `js/map/`, `tools/` |
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
- `outdoor-paths.json` 的节点、边、折线和审核状态是否有效
- 室内入口、楼层、房间/设施节点是否可用
- 示例路线是否可达

如果出现“致命问题”，不要合并数据。若只有 `draft` 或单向 `connections` 建议，可以先记录为后续修正任务，但演示主路线应尽量达到 `reviewed`。

# 南京大学智能校园地图 — AI 协作上下文

## 项目概述

四人小组开发南京大学仙林校区智能校园地图网站。核心功能：总地图层的重要目标导航 + 建筑室内的房间/设施级路径规划。当前重点是建立真实可通行路径网络，避免路线只是建筑物坐标或节点直连。

**工期**：一个月（2026年6月），半个月后初期检查。

## 初期检查交付物（第2周末）

1. 技术文档（架构说明、数据格式、接口文档）
2. 展示 PPT（10-12 页）
3. 核心代码（室外地图 + 至少1栋建筑室内图 + A*路径规划跑通 + 搜索可用）

## 技术决策（经讨论确认）

- **初期**：HTML/CSS/JS 原生 + Leaflet.js 1.9.4，不引入框架
- **初期检查后**：有可能用现代框架重构 UI 层，但地图/算法层尽量复用
- **室内渲染**：Canvas API（灵活绘制走廊/房间/楼梯）
- **路径规划**：自实现 A* 算法（可控、可优化）
- **数据格式**：JSON 静态文件，不用数据库
- **部署方式**：初期本地演示（`python -m http.server` 或 `npx serve`）
- **地图瓦片**：OpenStreetMap（国内可能慢，可替换为高德/天地图瓦片）
- **协作**：GitHub，4 个开发分支 + main 稳定分支

## 项目结构

```
js/map/     ← A 负责：室外Leaflet地图、室内Canvas渲染、图层切换
js/nav/     ← B 负责：Graph类、AStar算法、室内外图构建、路径渲染
js/ui/      ← C 负责：搜索框、信息面板、标记交互
css/        ← C 负责：全局样式、地图样式、室内样式
data/       ← D 负责：建筑数据、室外目标、室外路径折线、室内数据
docs/       ← D 负责：架构文档、数据格式、路径标注流程、PPT
tools/      ← A/D 共同维护：路径图片标注工具
js/app.js   ← 总调度，所有模块在此协调
js/config.js← 全局配置常量
```

## 核心数据模型（所有模块必须遵守）

```js
// 图节点 — AStar 输入/输出的统一格式
{
  id: "buildingId-floor-type-suffix",  // 例: "yifu-2f-corridor-north"
  type: "corridor|room|facility|stair|elevator|entrance|road|target",
  lat: 32.xxx, lng: 118.xxx,   // 室内坐标按建筑比例映射
  floor: 0,                     // 室外=0, 室内=实际楼层
  building: "buildingId|null",
  label: "中文显示名",
  connections: ["邻接节点ID"]   // 跨层通过楼梯/电梯节点的 connections 实现
}
```

## 模块间接口约定

- **A(B) → B**：不直接调用。A 渲染地图，B 提供图数据，通过 app.js 协调
- **B → A/C**：`AStar.findPath(graph, startId, goalId)` → `{ path: GraphNode[], distance }`
- **C → app.js**：`searchBox.onChange(role, item)` — 用户选好起终点时通知
- **D → A/B/C**：提供约定格式的 JSON 文件。所有模块通过 `DataLoader.loadJSON()` 读取
- **路径折线**：`data/outdoor-paths.json` 的 `edges[].path` 用于室外路径渲染和边权计算
- **图层切换**：`layerSwitch.enterIndoor(building, indoorData, floor)` / `exitToOutdoor()`

## 关键设计约定

1. 室外图中建筑入口通过 `registerBuildingEntrance()` 注册，自动连接室内外图
2. 室内图首次进入时才动态加载（`DataLoader.loadIndoor(buildingId)`）
3. 路径结果调用 `PathRenderer.segmentPath()` 分为室外/室内段后再渲染
4. 搜索索引由建筑列表 + 室外目标列表 + 室内 room/facility 节点共同构建
5. 室外路径不再只画节点直线，`PathRenderer.setOutdoorPathNetwork()` 会注册 `edge.path`
6. Canvas 室内图坐标以建筑中心为原点，`latlngToXY()` 做经纬度→像素映射
7. 图片标注工具导出的像素 JSON 是中间产物，审核后再合并进正式数据

## 代码约定

- 原生 JS，ES6+ class
- 文件顶部不写大段注释，用类和函数名自描述
- 模块间通过 app.js 沟通，避免模块间直接引用
- 全局变量只用 `CONFIG` 和类名（如 `Graph`, `AStar`, `OutdoorMap`）
- 不引入任何 npm 依赖，Leaflet 目前用 CDN；演示前需确认网络，必要时改成本地 `lib/leaflet/`

## 南京大学仙林校区参考坐标

- 中心：32.119°N, 118.957°E
- 已录入数据：杜厦图书馆、逸夫楼、仙I/仙II教学楼、方肇周体育馆、一组团食堂、大学生活动中心、基础实验楼
- 室内精细数据已完成：逸夫楼（3层）、图书馆（3层）

## 路径数据相关文档

- `docs/data-format.md`：正式数据文件格式
- `docs/path-data-format.md`：路径网络和标注导出格式
- `docs/path-data-workflow.md`：图片到路径数据的人机合作流程
- `docs/member-guides.md`：四名组员的详细操作指南

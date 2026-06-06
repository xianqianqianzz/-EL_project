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
- **室外底图**：每个区域使用独立 `map.png`，Leaflet CRS.Simple 按图片像素显示
- **协作**：GitHub，4 个开发分支 + main 稳定分支

## 项目结构

```
js/map/     ← A 负责：室外Leaflet地图、室内Canvas渲染、图层切换
js/nav/     ← B 负责：Graph类、AStar算法、室内外图构建、路径渲染
js/ui/      ← C 负责：搜索框、信息面板、标记交互
css/        ← C 负责：全局样式、地图样式、室内样式
data/       ← D 负责：区域索引与每个区域唯一的 area.json
docs/       ← D 负责：架构文档、数据格式、路径标注流程、PPT
tools/      ← A/D 共同维护：路径图片标注工具
js/app.js   ← 总调度，所有模块在此协调
js/config.js← 全局配置常量
```

## 核心数据模型（所有模块必须遵守）

```js
// 区域标注节点
{
  id: "area-node-suffix",
  type: "node",
  x: 2200, y: 5900
}
```

## 模块间接口约定

- **A(B) → B**：不直接调用。A 渲染地图，B 提供图数据，通过 app.js 协调
- **B → A/C**：`AStar.findPath(graph, startId, goalId)` → `{ path: GraphNode[], distance }`
- **C → app.js**：`searchBox.onChange(role, item)` — 用户选好起终点时通知
- **D → A/B/C**：提供约定格式的 JSON 文件。所有模块通过 `DataLoader.loadJSON()` 读取
- **区域入口**：室外演示区域为 `data/areas/outdoor-xianlin/area.json`，由 `DataLoader.normalizeOutdoorArea()` 转换为运行时数据
- **室外图结构**：区域 `area.json` 的 `node` 只保存自动 ID 和 `x/y`；`edge` 只保存 `from/to`，弯路通过增加节点分段表示
- **图层切换**：`layerSwitch.enterIndoor(building, indoorData, floor)` / `exitToOutdoor()`

## 关键设计约定

1. 所有区域只从 `data/areas/index.json` 注册的 `area.json` 加载
2. 室内区域也必须使用独立区域文件夹和 `area.json`
3. 路径结果调用 `PathRenderer.segmentPath()` 分为室外/室内段后再渲染
4. 室外搜索索引只由 `area.json.places` 构建；带 `buildingId` 的地点可以接入建筑详情和室内数据
5. 室外路线按 A* 返回的连续节点坐标绘制，边权由相邻节点的像素距离计算
6. 所有正式区域数据只使用图片像素坐标
7. 图片标注工具直接导出可运行的区域 `area.json`，审核后可替换正式文件
8. 人工标注对象只使用 `place/node/edge` 三种类型；只有 `place` 使用 `label`

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

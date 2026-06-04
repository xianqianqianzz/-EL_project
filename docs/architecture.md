# 系统架构说明

## 项目背景

南京大学智能校园地图系统，为师生提供两层路径导航：总地图层负责大型建筑物和重要室外目标之间的导航；进入建筑后，室内层负责教室、阅览区、厕所等房间/设施级导航。项目针对南京大学仙林校区，重点保证数据接口清晰、可协作录入。

## 技术选型

| 层面 | 选择 | 原因 |
|------|------|------|
| 地图渲染 | Leaflet.js + Canvas | Leaflet 成熟稳定，Canvas 灵活适合室内 |
| 路径规划 | A* 算法（自实现） | 可控、可优化，适合校园级图规模 |
| 数据格式 | JSON + 路径标注导出 JSON | 简单直观，前后端通用；图片标注结果可逐步合并 |
| 架构模式 | 模块化原生 JS | 初期不引入框架，降低学习成本 |

## 系统架构图

```
┌─────────────────────────────────────────────┐
│                  index.html                  │
├─────────────────────────────────────────────┤
│  app.js (总调度)                             │
├──────────┬──────────┬────────────┬──────────┤
│ map/     │ nav/     │ ui/        │ data/    │
│ outdoor  │ graph    │ search     │ loader   │
│ indoor   │ astar    │ panel      │ validator│
│ layer-   │ outdoor- │ marker-    │          │
│ switch   │ graph    │ popup      │          │
│          │ indoor-  │            │          │
│          │ graph    │            │          │
│          │ path-    │            │          │
│          │ renderer │            │          │
├──────────┴──────────┴────────────┴──────────┤
│  Leaflet.js  │  Canvas API  │  Fetch API     │
└─────────────────────────────────────────────┘
```

## 核心数据流

1. D 组提供 `buildings.json`、`outdoor-targets.json`、`outdoor-nodes.json`、`outdoor-paths.json` 和室内 JSON。
2. `app.js` 将建筑和室外目标转成 `SearchItem`，其中 `routeNodeId` 指向实际 Graph 节点。
3. `OutdoorGraphBuilder` 优先用 `outdoor-paths.json` 的 `edge.path` 计算室外边权。
4. 用户输入起终点 → `search.js` 返回 `SearchItem`。
5. `app.js` 取起终点的 `routeNodeId`，必要时自动加载室内数据。
6. `app.js` 调用 `AStar.findPath(graph, fromId, toId)`。
7. 路径结果 → `path-renderer.js` 分段渲染；室外段优先沿 `edge.path` 折线绘制。
8. 若含室内段 → `layer-switch.js` 自动切换至室内视图。
9. `panel.js` 展示路线详情。

## 模块接口

### 地图模块 (map/) → 供 app.js 调用

```js
// 室外
outdoorMap.renderBuildings(buildings);
outdoorMap.renderOutdoorTargets(outdoorTargets);
outdoorMap.setView(lat, lng, zoom);

// 室内
indoorMap.loadBuilding(buildingId, indoorData);
indoorMap.switchFloor(floor);
indoorMap.render(pathNodes);

// 图层
layerSwitch.enterIndoor(building, indoorData, floor);
layerSwitch.exitToOutdoor();
```

### 导航模块 (nav/) → 供 app.js 调用

```js
// 构建
outdoorGraphBuilder.build(nodes, edges, outdoorPathNetwork);
outdoorGraphBuilder.registerBuildingEntrance(building);
indoorGraphBuilder.build(buildingId, indoorData);

// 寻路
AStar.findPath(graph, startId, goalId) → { path, distance }

// 渲染
pathRenderer.setOutdoorPathNetwork(outdoorPathNetwork);
pathRenderer.drawOutdoor(leafletMap, pathNodes);
pathRenderer.drawIndoor(canvasCtx, pathNodes, floor, coordFn);
```

### UI 模块 (ui/) → 供 app.js 调用

```js
searchBox.buildIndex(items);
searchBox.onChange(callback);
infoPanel.showRoute(routeResult);
infoPanel.showBuilding(building);
```

`SearchItem` 关键约定：

```js
{
  id: 'target-south-gate',      // 搜索条目 ID
  label: '南门',
  type: 'building|outdoor-target|room|facility|custom',
  buildingId: 'yifu',           // 室内目标才需要
  routeNodeId: 'gate-south',    // A* 真正使用的 Graph 节点
  lat: 32.115,
  lng: 118.957,
  floor: 0
}
```

## 当前实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 室外地图渲染 | 开发中 | Leaflet 底图 + 建筑多边形 + 室外目标标记 |
| 室内地图渲染 | 开发中 | Canvas 绘制走廊/房间/楼梯，支持楼层切换 |
| A* 路径规划 | 开发中 | 室外路网 + 室内走廊图 + 跨层连接 |
| 搜索 | 开发中 | 模糊匹配总地图目标、室内房间、室内设施 |
| 建筑数据 | ✅ 完成 | 8 栋建筑，含坐标和轮廓 |
| 室外路网 | ✅ 完成 | 21 个节点覆盖主要道路 |
| 室外路径折线 | 初版完成 | `outdoor-paths.json` 已接入边权和渲染，部分边仍需人工审核 |
| 室外目标数据 | ✅ 完成 | 9 个重要目标（校门/公交/地铁/食堂/超市/停车场） |
| 室内数据 | 部分完成 | 逸夫楼、图书馆已录入房间目标，并添加少量卫生间示例 |

## 已知限制

- **地图瓦片速度**：OpenStreetMap 国内加载可能较慢，可替换为高德/天地图瓦片
- **室内数据覆盖**：初期仅逸夫楼和图书馆有室内数据，其余 6 栋建筑待补充
- **室外目标粒度**：总地图只保留重要目标，楼内细节必须进入室内数据
- **路径折线审核**：`outdoor-paths.json` 目前是起步样例，主演示路线应先人工审核为 `reviewed`
- **无后端服务**：纯静态 JSON 文件，不支持用户数据持久化
- **无移动端优化**：初期以桌面端为主，移动端适配待后期处理

## 数据格式

详见：

- `docs/data-format.md`
- `docs/path-data-format.md`
- `docs/path-data-workflow.md`

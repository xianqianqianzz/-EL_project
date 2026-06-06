# 系统架构说明

## 项目背景

南京大学智能校园地图系统，为师生提供两层路径导航：总地图层负责大型建筑物和重要室外目标之间的导航；进入建筑后，室内层负责教室、阅览区、厕所等房间/设施级导航。项目针对南京大学仙林校区，重点保证数据接口清晰、可协作录入。

## 技术选型

| 层面 | 选择 | 原因 |
|------|------|------|
| 地图渲染 | Leaflet CRS.Simple + Canvas | 室外直接显示区域底图像素，Canvas 灵活适合室内 |
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

1. D 组在 `data/areas/index.json` 注册区域；每个区域只提供自己的 `map.png` 和 `area.json`。
2. `DataLoader.normalizeOutdoorArea()` 将区域 `area.json` 转成当前运行所需的室外目标、节点和边。
3. `app.js` 将 `area.json.places` 转成 `SearchItem`，其中 `routeNodeId` 指向实际 Graph 节点；可选 `buildingId` 用于关联建筑详情和室内数据。
4. `OutdoorGraphBuilder` 用每条边两端节点的像素距离乘 `image.metersPerPixel` 计算室外边权。
5. 用户输入起终点 → `search.js` 返回 `SearchItem`。
   用户也可以点击“地图选择”进入起点或终点选择状态，此时 `OutdoorMap.showSelectableNodes()` 显示区域全部路网节点。
6. `app.js` 取起终点的 `routeNodeId`，必要时自动加载室内数据。
7. `app.js` 调用 `AStar.findPath(graph, fromId, toId)`。
8. 路径结果 → `path-renderer.js` 分段渲染；室外段按连续节点坐标绘制。
9. 若含室内段 → `layer-switch.js` 自动切换至室内视图。
10. `panel.js` 展示路线详情。

## 模块接口

### 地图模块 (map/) → 供 app.js 调用

```js
// 室外
outdoorMap.renderBuildings(buildings, outdoorTargets);
outdoorMap.renderOutdoorTargets(outdoorTargets);
outdoorMap.configureArea(areaData, areaPath);
outdoorMap.setView(x, y, zoom);
outdoorMap.showSelectableNodes(items, role, onSelect);
outdoorMap.hideSelectableNodes();

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
indoorGraphBuilder.build(buildingId, indoorData, outdoorPlace.routeNodeId);

// 寻路
AStar.findPath(graph, startId, goalId) → { path, distance }

// 渲染
outdoorGraphBuilder.build(outdoorNodes.nodes, outdoorNodes.edges, outdoorPathNetwork);
pathRenderer.drawOutdoor(leafletMap, pathNodes);
pathRenderer.drawIndoor(canvasCtx, pathNodes, floor, coordFn);
```

### 数据模块 (data/) → 供 app.js 调用

```js
DataLoader.loadJSON(CONFIG.dataPaths.areasIndex);
DataLoader.loadJSON(defaultAreaEntry.path);
DataLoader.normalizeOutdoorArea(areaData)
// → { outdoorTargets, outdoorNodes, outdoorPaths }
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
  x: 2200,
  y: 5900,
  floor: 0
}
```

## 当前实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 室外地图渲染 | 开发中 | Leaflet CRS.Simple + 区域 map.png + 像素目标标记 |
| 室内地图渲染 | 开发中 | Canvas 绘制走廊/房间/楼梯，支持楼层切换 |
| A* 路径规划 | 开发中 | 室外路网 + 室内走廊图 + 跨层连接 |
| 搜索 | 开发中 | 模糊匹配总地图目标、室内房间、室内设施 |
| 区域数据入口 | ✅ 完成 | 所有区域只通过 `data/areas/index.json` 注册 |
| 室外区域数据 | 初版完成 | `outdoor-xianlin/area.json` 包含 2 个地点、14 个节点、17 条边 |
| 地图选点 | ✅ 完成 | 显式进入选择起点/终点状态，并显示全部可选节点 |
| 室内区域 | 待标注 | 后续按相同的区域文件夹和 `area.json` 规范添加 |

## 已知限制

- **区域比例误差**：`metersPerPixel` 是近似值，距离和时间需要通过实际路线校准
- **室内数据覆盖**：旧室内样例已删除，后续需要按统一区域格式重新标注
- **室外目标粒度**：总地图只保留重要目标，楼内细节必须进入室内数据
- **节点与边审核**：`outdoor-xianlin/area.json` 目前是起步样例，主演示路线应先人工审核为 `reviewed`
- **无后端服务**：纯静态 JSON 文件，不支持用户数据持久化
- **无移动端优化**：初期以桌面端为主，移动端适配待后期处理

## 数据格式

详见：

- `docs/data-format.md`
- `docs/path-data-format.md`
- `docs/path-data-workflow.md`

# 系统架构说明

## 项目背景

南京大学智能校园地图系统，为师生提供校园内室外+室内的精细化路径导航。项目针对南京大学仙林校区，支持在大建筑物内实现走廊级的精确导航。

## 技术选型

| 层面 | 选择 | 原因 |
|------|------|------|
| 地图渲染 | Leaflet.js + Canvas | Leaflet 成熟稳定，Canvas 灵活适合室内 |
| 路径规划 | A* 算法（自实现） | 可控、可优化，适合校园级图规模 |
| 数据格式 | JSON | 简单直观，前后端通用 |
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

1. 用户输入起终点 → `search.js` 解析为节点ID
2. `app.js` 调用 `AStar.findPath(graph, fromId, toId)`
3. 若目标在室内且未加载 → 自动加载室内数据
4. 路径结果 → `path-renderer.js` 分段渲染
5. 若含室内段 → `layer-switch.js` 自动切换至室内视图
6. `panel.js` 展示路线详情

## 模块接口

### 地图模块 (map/) → 供 app.js 调用

```js
// 室外
outdoorMap.renderBuildings(buildings);
outdoorMap.renderPOIs(pois);
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
outdoorGraphBuilder.build(nodes, edges);
outdoorGraphBuilder.registerBuildingEntrance(building);
indoorGraphBuilder.build(buildingId, indoorData);

// 寻路
AStar.findPath(graph, startId, goalId) → { path, distance }

// 渲染
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

## 当前实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 室外地图渲染 | 开发中 | Leaflet 底图 + 建筑多边形 + POI 标记 |
| 室内地图渲染 | 开发中 | Canvas 绘制走廊/房间/楼梯，支持楼层切换 |
| A* 路径规划 | 开发中 | 室外路网 + 室内走廊图 + 跨层连接 |
| 搜索 | 开发中 | 模糊匹配建筑名/房间号/POI |
| 建筑数据 | ✅ 完成 | 8 栋建筑，含坐标和轮廓 |
| 室外路网 | ✅ 完成 | 21 个节点覆盖主要道路 |
| POI 数据 | ✅ 完成 | 9 个 POI（校门/公交/地铁/食堂/超市） |
| 室内数据 | 部分完成 | 逸夫楼 3/6 层、图书馆 3/5 层已录入 |

## 已知限制

- **地图瓦片速度**：OpenStreetMap 国内加载可能较慢，可替换为高德/天地图瓦片
- **室内数据覆盖**：初期仅逸夫楼和图书馆有室内数据，其余 6 栋建筑待补充
- **无后端服务**：纯静态 JSON 文件，不支持用户数据持久化
- **无移动端优化**：初期以桌面端为主，移动端适配待后期处理

## 数据格式

详见 `docs/data-format.md`

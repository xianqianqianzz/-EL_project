# 数据格式规范

本项目采用两层地图数据模型：

1. 总地图层：只处理大型建筑物和重要室外目标之间的导航。
2. 建筑室内层：进入某栋建筑后，按房间或室内设施导航。

总地图层不收录楼内细碎设施。饮水机、楼内厕所、楼内 ATM、自习室、单个教室等不应进入 `outdoor-targets.json`；确有导航需求时，应写入对应建筑的 `data/indoor/<building-id>.json`。

## 1. 文件职责

| 文件 | 职责 | 主要维护者 |
|------|------|------------|
| `data/buildings.json` | 大型建筑物清单，每栋建筑在总地图中只有一个入口目标 | D |
| `data/outdoor-targets.json` | 非建筑的重要室外目标，如校门、公交站、食堂、停车场 | D |
| `data/outdoor-nodes.json` | 兼容旧版 A* 的室外节点和连接关系 | B/D |
| `data/outdoor-paths.json` | 真实可通行室外折线网络，含 `edge.path` 和审核状态 | B/D |
| `data/indoor/*.json` | 单栋建筑的室内楼层、房间、设施、走廊和跨层连接 | B/D |
| `tools/path-editor.html` 导出 JSON | 图片像素坐标标注中间产物，不直接作为正式数据 | A/D |

## 2. 总地图搜索目标

总地图可搜索条目由两类数据合成：

- `buildings.json` 中的每栋建筑，寻路目标为 `entrance-<buildingId>`。
- `outdoor-targets.json` 中的重要室外目标，寻路目标为 `routeNodeId`。

运行时统一为 `SearchItem`：

```ts
{
  id: string;
  label: string;
  type: 'building' | 'outdoor-target' | 'room' | 'facility' | 'custom';
  buildingId?: string;
  routeNodeId: string;
  lat: number;
  lng: number;
  floor: number;          // 室外为 0
  keywords?: string[];
}
```

协作要求：

- C 组搜索模块只把 `routeNodeId` 交给寻路逻辑，不直接修改 Graph。
- B 组寻路模块只接收 Graph 节点 ID，不处理显示名称。
- D 组新增任何可搜索目标时，必须保证 `routeNodeId` 指向可寻路节点。

## 3. `buildings.json`

每栋建筑在总地图中只作为一个入口目标。建筑内部的教室、厕所、阅览区等写入室内数据。

```json
{
  "id": "yifu",
  "name": "逸夫楼（左涤江楼）",
  "aliases": ["逸夫教学楼", "左涤江楼"],
  "description": "建筑说明",
  "center": { "lat": 32.1200, "lng": 118.9585 },
  "entrance": {
    "lat": 32.1199,
    "lng": 118.9583,
    "nearestRoadNode": "road-yifu"
  },
  "floors": [1, 2, 3, 4, 5, 6],
  "indoorAvailable": true,
  "outline": [{ "lat": 32.1205, "lng": 118.9580 }]
}
```

入口规则：

- `OutdoorGraphBuilder.registerBuildingEntrance(building)` 会自动创建 `entrance-<buildingId>`。
- `entrance.nearestRoadNode` 必须指向存在的室外路网节点。
- `indoorAvailable: true` 时，必须准备对应 `data/indoor/<buildingId>.json`。

## 4. `outdoor-targets.json`

只收录总地图层非建筑的重要目标。

```json
{
  "id": "target-south-gate",
  "name": "南门",
  "aliases": ["正门", "南大门"],
  "type": "gate",
  "icon": "gate",
  "lat": 32.1150,
  "lng": 118.9570,
  "label": "南京大学仙林校区南门",
  "routeNodeId": "gate-south"
}
```

允许的 `type`：

- `gate`：校门
- `transit`：公交、地铁等交通点
- `canteen`：总地图需要直接导航的食堂
- `shop`：总地图需要直接导航的商店
- `parking`：停车场
- `landmark`：广场、湖、操场等重要室外地标

不应写入此文件：

- 楼内厕所、饮水机、ATM、教室、自习室、阅览区
- 仅用于算法转折的道路节点
- 过细且不承担主要导航目标的设施

## 5. `outdoor-nodes.json`

该文件保留为兼容层，描述室外 Graph 的基础节点和连接。它不等同于用户可搜索目标。

```json
{
  "nodes": [{
    "id": "road-yifu",
    "type": "road",
    "lat": 32.1199,
    "lng": 118.9580,
    "label": "逸夫楼前（远东大道东）",
    "connections": ["road-center-north", "road-library-east"]
  }],
  "edges": [{
    "from": "road-yifu",
    "to": "road-center-north",
    "weight": 120
  }]
}
```

允许的 `type`：

- `road`：普通道路节点
- `junction`：交叉口
- `target`：同时作为路网节点的室外目标，例如校门

`connections` 应尽量双向书写。代码会先加载所有节点，再补齐连接，因此节点书写顺序不会影响运行。

## 6. `outdoor-paths.json`

该文件用于解决路线不合理的问题。它描述真实可走折线，`edge.path` 同时用于距离计算和室外路径渲染。

```json
{
  "version": 1,
  "coordinateSystem": "wgs84",
  "source": {
    "type": "hand-traced-sample",
    "image": "assets/source-maps/outdoor-xianlin-overview.png",
    "reviewStatus": "draft",
    "notes": "由地图图片人工描线生成"
  },
  "nodes": [{
    "id": "road-yifu",
    "type": "road",
    "lat": 32.1199,
    "lng": 118.9580,
    "label": "逸夫楼前"
  }],
  "edges": [{
    "id": "outdoor-edge-road-center-north-road-yifu",
    "from": "road-center-north",
    "to": "road-yifu",
    "type": "walkway",
    "walkable": true,
    "path": [
      [32.1195, 118.9570],
      [32.1197, 118.9575],
      [32.1199, 118.9580]
    ],
    "reviewStatus": "reviewed"
  }]
}
```

字段要求：

| 字段 | 要求 |
|------|------|
| `coordinateSystem` | 室外固定为 `wgs84` |
| `nodes[].id` | 应与 `outdoor-nodes.json` 对接，新增细节点也必须唯一 |
| `edges[].id` | 必须唯一 |
| `edges[].from/to` | 必须指向 `nodes[].id` |
| `edges[].path` | 至少两个 `[lat, lng]` 点，首尾应贴合 from/to 节点 |
| `edges[].type` | `walkway/road/crossing/stair/ramp/bridge/entrance-link` |
| `edges[].walkable` | `false` 表示暂不参与寻路 |
| `reviewStatus` | `draft/reviewed/needs-review` |

审核状态规则：

- `draft`：刚标注，未审核。
- `needs-review`：标注者不确定，需要小组复核。
- `reviewed`：已用示例路线确认可走。

## 7. `indoor/<building-id>.json`

室内层同时包含楼层绘制信息和室内寻路图。室内可搜索目标只使用 `room` 或 `facility`。

```json
{
  "bounds": {
    "minLat": 32.1194,
    "maxLat": 32.1206,
    "minLng": 118.9580,
    "maxLng": 118.9592
  },
  "entranceLink": "yifu-1f-entrance",
  "floors": [{
    "level": 1,
    "label": "1F",
    "rooms": [{
      "x": -350,
      "y": -250,
      "w": 80,
      "h": 50,
      "label": "A101",
      "color": "#e8f5e9"
    }]
  }],
  "nodes": [{
    "id": "yifu-1f-room-A101",
    "type": "room",
    "lat": 32.1202,
    "lng": 118.9580,
    "floor": 1,
    "building": "yifu",
    "label": "A101教室",
    "connections": ["yifu-1f-corridor-center"]
  }],
  "edges": []
}
```

室内节点类型：

- `entrance`：建筑入口
- `corridor`：走廊或室内转折点
- `room`：教室、办公室、阅览区、会议室等可搜索目标
- `facility`：厕所、服务台、饮水点等室内设施目标
- `stair`：楼梯
- `elevator`：电梯

搜索规则：

- C 组搜索只索引 `room` 和 `facility`。
- `corridor/stair/elevator/entrance` 默认只参与路径规划。
- 房间节点应连接到门口或最近走廊，不应跨墙连接到其他房间。

## 8. GraphNode 运行时格式

所有寻路节点最终统一为：

```ts
{
  id: string;
  type: 'corridor' | 'room' | 'facility' | 'stair' | 'elevator' | 'entrance' | 'road' | 'target';
  lat: number;
  lng: number;
  floor: number;
  building?: string;
  label: string;
  connections?: string[];
}
```

## 9. 数据验证

新增或修改数据后运行：

```bash
npm.cmd run validate:data
```

脚本会检查：

- JSON 是否可读取。
- 所有 `id` 是否唯一。
- `connections` 引用的节点是否存在。
- 建筑入口 `nearestRoadNode` 是否存在。
- 室外目标 `routeNodeId` 是否能映射到 Graph 节点。
- `outdoor-paths.json` 的边是否有有效 `path` 和 `reviewStatus`。
- 室内 `entranceLink` 是否存在。
- 室内可搜索目标是否可以参与路线。
- 示例路线是否可达。

出现致命问题时不能合并。只有 `draft`、`needs-review` 或单向 `connections` 建议时，可以先记录为任务，但演示路线应尽量全部审核。

## 10. 添加数据的建议顺序

### 新增总地图建筑

1. 在 `buildings.json` 添加建筑。
2. 在 `outdoor-nodes.json` 确保入口附近有道路节点。
3. 填写 `entrance.nearestRoadNode`。
4. 在 `outdoor-paths.json` 添加入口附近可通行折线。
5. 如有室内数据，创建 `data/indoor/<buildingId>.json` 并设置 `indoorAvailable: true`。

### 新增室外目标

1. 判断它是否属于总地图重要目标。
2. 在 `outdoor-targets.json` 添加目标。
3. 将 `routeNodeId` 指向最近的室外路网节点。
4. 确认该节点也存在于 `outdoor-paths.json`。

### 新增室内目标

1. 在对应 `indoor/*.json` 的 `nodes` 中添加 `room` 或 `facility`。
2. 将该节点连接到门口或最近走廊。
3. 如需可视化房间块，同步在对应楼层 `rooms` 中添加矩形。
4. 运行校验并用至少一条路线人工检查。

路径网络更详细的格式和图片标注流程见：

- `docs/path-data-format.md`
- `docs/path-data-workflow.md`

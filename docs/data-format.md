# 数据格式规范

## 1. buildings.json

```json
[{
  "id": "string (唯一标识)",
  "name": "string (建筑名称)",
  "aliases": ["string[] 别名，用于搜索"],
  "description": "string",
  "center": { "lat": number, "lng": number },
  "entrance": {
    "lat": number,
    "lng": number,
    "nearestRoadNode": "string (最近室外道路节点ID)"
  },
  "floors": [1, 2, 3, ...],
  "indoorAvailable": true/false,
  "outline": [{ "lat": number, "lng": number }]
}]
```

## 2. outdoor-nodes.json

```json
{
  "nodes": [{
    "id": "string",
    "type": "road|poi|junction",
    "lat": number,
    "lng": number,
    "label": "string",
    "connections": ["邻近节点ID"]
  }],
  "edges": [{
    "from": "string",
    "to": "string",
    "weight": number  // 可选，不填则自动计算
  }]
}
```

## 3. poi.json

```json
[{
  "id": "string",
  "name": "string",
  "aliases": ["string[]"],
  "type": "gate|bus|subway|canteen|shop|bathroom|atm|parking|bike_rack|water",
  "icon": "emoji",
  "lat": number,
  "lng": number,
  "label": "string"
}]
```

## 4. indoor/<building-id>.json

```json
{
  "bounds": {
    "minLat": number, "maxLat": number,
    "minLng": number, "maxLng": number
  },
  "entranceLink": "string (室内入口节点ID)",
  "floors": [{
    "level": number,
    "label": "string (如 1F)",
    "rooms": [{
      "x": number, "y": number, "w": number, "h": number,
      "label": "string",
      "color": "#hex"
    }],
    "corridors": [{
      "x": number, "y": number, "w": number, "h": number,
      "label": "string"
    }],
    "verticals": [{
      "x": number, "y": number, "w": number, "h": number,
      "type": "stair|elevator",
      "label": "string"
    }]
  }],
  "nodes": [{
    "id": "string (格式: {buildingId}-{floor}f-{type}-{suffix})",
    "type": "entrance|corridor|room|stair|elevator",
    "lat": number,
    "lng": number,
    "floor": number,
    "label": "string",
    "connections": ["string[] 邻近节点ID"]
  }],
  "edges": []
}
```

## 5. 图节点统一格式 (GraphNode)

运行时所有数据统一为此格式：

```ts
{
  id: string;
  type: 'corridor' | 'room' | 'stair' | 'elevator' | 'entrance' | 'road' | 'path' | 'poi';
  lat: number;
  lng: number;
  floor: number;      // 室外为 0
  building: string?;   // 所属建筑ID，室外为 null
  label: string;
  connections: string[];
}
```

## 6. edges 与 connections 的关系

`outdoor-nodes.json` 和室内数据都包含 `edges` 和 `nodes[].connections` 两个字段：

- **`connections`**（主要）：写在每个节点上，表示该节点与哪些节点相邻。更符合人类的编辑习惯，是主要的数据编写方式。
- **`edges`**（可选）：显式边列表，可包含 `weight` 字段覆盖默认的 haversine 距离计算。若不提供，运行时由 `Graph.addNode()` 从 `connections` 自动推导。

**注意**：`connections` 应为双向（A 的 connections 含 B，B 的 connections 含 A），但 `edges` 中每条无向边只需出现一次。

## 建筑坐标速查表

| 建筑ID | 名称 | 中心坐标 | 入口坐标 | 楼层 |
|--------|------|----------|----------|------|
| `xian1` | 仙I教学楼 | 32.1170, 118.9550 | 32.1172, 118.9552 | 1-5 |
| `xian2` | 仙II教学楼 | 32.1180, 118.9550 | 32.1181, 118.9552 | 1-5 |
| `library` | 杜厦图书馆 | 32.1190, 118.9570 | 32.1188, 118.9568 | 1-5 |
| `yifu` | 逸夫楼 | 32.1200, 118.9585 | 32.1199, 118.9583 | 1-6 |
| `gym` | 方肇周体育馆 | 32.1200, 118.9530 | 32.1200, 118.9532 | 1-2 |
| `canteen1` | 一组团食堂 | 32.1160, 118.9580 | 32.1161, 118.9581 | 1-3 |
| `student-center` | 大学生活动中心 | 32.1180, 118.9535 | 32.1180, 118.9537 | 1-3 |
| `basic-lab` | 基础实验楼 | 32.1210, 118.9560 | 32.1209, 118.9558 | 1-6 |

## 数据验证清单

新增或修改数据文件后，逐项检查：

- [ ] JSON 语法正确（可用 `JSON.parse` 验证）
- [ ] 所有节点 `id` 唯一且符合命名规范
- [ ] 所有 `connections` 双向对称（A→B 且 B→A）
- [ ] 室内节点 `floor` 字段与实际楼层一致
- [ ] 楼梯/电梯节点跨层连接正确
- [ ] 建筑 `entrance.nearestRoadNode` 指向存在的室外节点
- [ ] `indoorAvailable` 与实际室内数据文件存在性一致
- [ ] 新建筑已在 `buildings.json` 中注册

## 添加新建筑室内数据的步骤

1. 在 `data/indoor/` 下创建 `<buildingId>.json`
2. 定义 `bounds`（经纬度边界）
3. 定义每个楼层的 `rooms`, `corridors`, `verticals`（Canvas 像素坐标）
4. 定义 `nodes`（路径图节点，经纬度坐标）
5. 定义楼层间的楼梯/电梯连接（通过 `connections` 跨层引用）
6. 在 `buildings.json` 中将 `indoorAvailable` 设为 `true`

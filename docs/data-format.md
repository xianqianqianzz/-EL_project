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
  "type": "gate|bus|subway|canteen|shop",
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

## 添加新建筑室内数据的步骤

1. 在 `data/indoor/` 下创建 `<buildingId>.json`
2. 定义 `bounds`（经纬度边界）
3. 定义每个楼层的 `rooms`, `corridors`, `verticals`（Canvas 像素坐标）
4. 定义 `nodes`（路径图节点，经纬度坐标）
5. 定义楼层间的楼梯/电梯连接（通过 `connections` 跨层引用）
6. 在 `buildings.json` 中将 `indoorAvailable` 设为 `true`

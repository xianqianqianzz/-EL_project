# 路径网络数据格式

路径规划的关键不是建筑物坐标，而是“人能走的线网”。本规范用于描述从地图图片或楼层平面图中人工/半自动提取出的可通行路径。

## 1. 文件职责

| 文件 | 坐标系 | 作用 |
|------|--------|------|
| `data/outdoor-paths.json` | WGS84 经纬度 | 室外道路、广场通道、入口连接线 |
| `data/indoor/<building-id>.json` | 当前仍兼容经纬度节点；后续可补充像素路径 | 建筑室内走廊、房间门、楼梯、电梯 |
| 标注工具导出的 JSON | 图片像素坐标 | 人工标注原始结果，需要审核后合并进正式数据 |

## 2. 室外路径网络

`data/outdoor-paths.json` 用折线表示真实可走路径，`edge.path` 是渲染和距离计算的依据。

当前项目仍保留 `data/outdoor-nodes.json` 作为兼容层：它提供基础节点和旧连接；`data/outdoor-paths.json` 提供更精确的边几何。两者出现同一条边时，运行时优先使用 `outdoor-paths.json` 的折线长度作为边权，渲染也优先沿 `edge.path` 画线。

```json
{
  "version": 1,
  "coordinateSystem": "wgs84",
  "source": {
    "type": "hand-traced",
    "image": "assets/screenshots/nju-electronic-map.png",
    "reviewStatus": "draft"
  },
  "nodes": [{
    "id": "road-yifu",
    "type": "road",
    "lat": 32.1199,
    "lng": 118.9580,
    "label": "逸夫楼前"
  }],
  "edges": [{
    "id": "outdoor-edge-yifu-center",
    "from": "road-yifu",
    "to": "road-center-north",
    "type": "walkway",
    "walkable": true,
    "path": [
      [32.1199, 118.9580],
      [32.1197, 118.9575],
      [32.1195, 118.9570]
    ],
    "reviewStatus": "reviewed"
  }]
}
```

字段说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| `version` | 是 | 当前固定为 `1` |
| `coordinateSystem` | 是 | 室外固定为 `wgs84` |
| `nodes[].id` | 是 | 路径节点 ID，应与 `outdoor-nodes.json` 可对接 |
| `nodes[].lat/lng` | 是 | 节点经纬度 |
| `edges[].from/to` | 是 | 起止节点 ID |
| `edges[].path` | 是 | 实际可走折线，至少两个点，点格式为 `[lat, lng]` |
| `edges[].walkable` | 是 | `false` 表示暂不参与寻路 |
| `edges[].type` | 是 | `walkway/road/crossing/stair/ramp/bridge/entrance-link` |
| `reviewStatus` | 是 | `draft/reviewed/needs-review` |

## 3. 室内路径网络

室内建议以图片像素坐标作为原始标注坐标。房间目标不要连接到房间中心，而要连接到门口节点。

```json
{
  "version": 1,
  "coordinateSystem": "image-pixel",
  "image": {
    "path": "assets/source-maps/yifu-1f.png",
    "width": 1200,
    "height": 800
  },
  "buildingId": "yifu",
  "floor": 1,
  "nodes": [{
    "id": "yifu-1f-door-A101",
    "type": "door",
    "x": 210,
    "y": 350,
    "label": "A101门口",
    "targetId": "yifu-1f-room-A101"
  }],
  "edges": [{
    "id": "yifu-1f-edge-001",
    "from": "yifu-1f-corridor-001",
    "to": "yifu-1f-door-A101",
    "type": "corridor",
    "walkable": true,
    "path": [[180, 350], [210, 350]],
    "reviewStatus": "draft"
  }]
}
```

室内节点类型：

- `corridor`：走廊转折点
- `door`：房间门口，通常带 `targetId`
- `room`：可搜索房间目标
- `facility`：厕所、服务台、饮水点等室内设施
- `stair`：楼梯点
- `elevator`：电梯点
- `entrance`：建筑入口

## 4. 标注工具导出格式

`tools/path-editor.html` 导出的 JSON 是中间产物，不直接等同于正式数据。D 组先导出，B 组或 AI 再转换/审核。

```json
{
  "version": 1,
  "coordinateSystem": "image-pixel",
  "meta": {
    "mapName": "yifu-1f",
    "imageName": "yifu-1f.png",
    "buildingId": "yifu",
    "floor": 1
  },
  "nodes": [],
  "edges": []
}
```

## 5. 审核状态

每条边都必须有 `reviewStatus`：

- `draft`：刚标注，未审核
- `needs-review`：标注者不确定，需要讨论
- `reviewed`：已用示例路线验证

## 6. 合格路径数据标准

- 每个可搜索目标必须能连接到路径网络。
- 每条边的 `path` 至少有两个点。
- 楼梯/电梯跨层必须在相邻楼层存在对应节点。
- 路径不能穿墙、穿建筑外轮廓或穿不可通行区域。
- 示例路线能覆盖：近距离、远距离、跨楼层、室外到室内。

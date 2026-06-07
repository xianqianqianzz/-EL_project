# area.json 数据格式

正式数据只允许三种对象：

| 对象 | 用途 | 必填字段 |
|---|---|---|
| `place` | 用户可搜索、可显示的地点 | `id,type,label,routeNodeId,x,y` |
| `node` | 路网拓扑节点 | `id,type,x,y` |
| `edge` | 两个节点之间的可通行边 | `id,type,from,to,walkable,reviewStatus` |

## 关键约束

- `coordinateSystem` 固定为 `image-pixel`。
- `image.width`、`image.height` 必须等于 `map.png` 原始尺寸。
- `node.type` 固定为 `node`，且不得包含 `label`、`connections`。
- `edge.type` 固定为 `edge`，且不得包含 `label`、`path`。
- `place.routeNodeId` 必须引用同文件内的节点。
- 边的几何起终点由 `from/to` 节点坐标决定。
- ID 在同类对象中必须唯一，建议格式为 `<area-id>-<type>-NNN`。

## 最小示例

```json
{
  "version": 2,
  "areaId": "outdoor-xianlin",
  "coordinateSystem": "image-pixel",
  "image": { "path": "map.png", "width": 4252, "height": 6378, "metersPerPixel": 0.21 },
  "places": [
    { "id": "outdoor-xianlin-place-001", "type": "place", "label": "南大门", "routeNodeId": "outdoor-xianlin-node-001", "x": 2726, "y": 5160 }
  ],
  "nodes": [
    { "id": "outdoor-xianlin-node-001", "type": "node", "x": 2726, "y": 5160 }
  ],
  "edges": [],
  "links": []
}
```

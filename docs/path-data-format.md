# 路径网络数据格式

区域路径数据直接基于区域文件夹中的唯一底图 `map.png`，统一使用图片像素坐标。标注工具导出的 `area.json` 可以直接由程序加载，不需要转换成经纬度。

## 1. 核心原则

- 同一个区域只能使用一张固定尺寸的 `map.png`。
- `map.png` 开始标注后不得裁剪、缩放或旋转。
- 图片左上角是 `(0, 0)`；向右 `x` 增大，向下 `y` 增大。
- 地点和路径节点全部使用同一套像素坐标。
- `node` 只保存自动生成的 `id` 与 `x/y`，不保存标签。
- `edge` 只保存 `from/to` 两个端点，不保存折线；道路弯曲处必须增加节点并分段连边。
- 距离通过 `image.metersPerPixel` 换算为米。
- 前端地图框架若采用向上的纵轴，只能在渲染层将 `[x, y]` 转为 `[-y, x]`；不得修改 JSON 中的原始像素坐标。
- 人工标注对象只分为三种：可搜索地点 `place`、普通路网节点 `node`、可通行路径 `edge`。
- 不再选择 `gate/road/building/walkway/crossing` 等子类型；地点含义写入 `place.label`，普通节点无需说明。
- 区域本身使用 `layer: outdoor/indoor` 表示地图层级，避免与标注对象的 `type` 混淆。

## 2. 区域文件夹

```text
data/areas/outdoor-xianlin/
├── map.png
└── area.json
```

- `map.png`：唯一底图。
- `area.json`：程序直接加载的正式数据。
- 标注阶段备份不得放入正式区域目录，可保存在项目外或单独的工作目录。

## 3. `area.json`

```json
{
  "version": 2,
  "areaId": "outdoor-xianlin",
  "name": "南京大学仙林校区室外总图",
  "layer": "outdoor",
  "coordinateSystem": "image-pixel",
  "image": {
    "path": "map.png",
    "width": 4252,
    "height": 6378,
    "metersPerPixel": 0.21
  },
  "places": [{
    "id": "target-south-gate",
    "type": "place",
    "label": "南门",
    "routeNodeId": "gate-south",
    "x": 2200,
    "y": 5900,
    "reviewStatus": "reviewed"
  }],
  "nodes": [{
    "id": "gate-south",
    "type": "node",
    "x": 2200,
    "y": 5900
  }],
  "edges": [{
    "id": "edge-gate-south-road-s1",
    "from": "gate-south",
    "to": "road-s1",
    "type": "edge",
    "walkable": true,
    "reviewStatus": "reviewed"
  }],
  "links": []
}
```

## 4. 字段职责

### `image`

| 字段 | 说明 |
|------|------|
| `path` | 相对区域文件夹的唯一底图路径，固定为 `map.png` |
| `width/height` | 图片原始像素尺寸，必须与实际文件一致 |
| `metersPerPixel` | 每个像素代表的近似米数，用于计算距离和预计时间 |

### `places`

用户可以搜索或点击的地点。`type` 固定为 `place`。地点位置使用 `x/y`，并通过 `routeNodeId` 接入路径网络。

南门、地铁站、食堂和建筑入口都属于 `place`，区别直接写在 `label` 中。

如果地点对应一栋可进入室内地图的建筑，应填写与室内区域索引项一致的可选 `buildingId`。未填写时，该地点仍可正常参与室外搜索和路径规划，但不会接入室内地图。

### `nodes`

只用于路径规划的节点。`type` 固定为 `node`。节点应放在路口、路径分叉、明显转折和地点入口附近。节点 ID 由工具自动生成，不填写 `label`，也不保存 `connections`。

创建 `place` 时，标注工具会自动在同一位置创建对应的 `node`。

### `edges`

表示两个节点之间可直接通行的一段直线。弯曲道路必须在每个明显转折处增加 `node`，再用多条 `edge` 连接。

| 字段 | 说明 |
|------|------|
| `from/to` | 必须指向区域内存在的节点 |
| `walkable` | `false` 时不参与寻路 |
| `type` | 固定为 `edge` |
| `reviewStatus` | `draft/reviewed/needs-review` |

### `links`

用于连接不同区域。例如室外建筑入口连接到该建筑室内 1F 区域。连接说明写入 `label`，不再设置连接子类型。

## 5. 标注工具直接输出

`tools/path-editor.html` 当前直接导出版本 2 的区域 JSON：

- 坐标已经是正式 `x/y`。
- 选择“地点 place”会同时生成 `place` 和对应的 `node`。
- 建筑地点如需接入室内地图，在创建前填写可选的“关联建筑 ID”。
- 选择“路网节点 node”后直接点击图片，工具自动生成无标签节点。
- 选择“连边 edge”后依次点击两个已有节点，工具立即生成一条边。
- 弯路需要先添加多个节点，再按道路顺序逐段连边。
- 可以导入已有 `area.json` 后继续标注。

下载后先在工作目录审核，确认无误后替换对应区域的正式 `area.json`。

## 6. 审核状态

- `draft`：刚标注，尚未人工确认。
- `needs-review`：来源或路线不确定，禁止当作最终路线。
- `reviewed`：已经根据底图和示例路线确认。

## 7. 合格标准

- 正式室外区域中不得出现 `lat/lng`。
- `places[].type` 必须为 `place`，`nodes[].type` 必须为 `node`，`edges[].type` 必须为 `edge`。
- 每个 `place` 都必须有容易理解的 `label`；`node` 和 `edge` 不使用 `label`。
- 每个地点必须包含有效 `x/y` 和 `routeNodeId`。
- 每条边必须连接两个存在的节点，且两节点间应能直接通行。
- 每条弯曲道路必须在转折处拆成多个节点和多条边。
- 路径不能穿建筑、草坪、水域或其他不可通行区域。
- 主演示路线涉及的边必须全部为 `reviewed`。
- `npm.cmd run validate:data` 必须报告 0 个致命问题。

## 8. 室内区域

室内地图同样使用独立区域文件夹、`map.png` 和 `area.json`，并通过 `areas/index.json` 中的 `buildingId` 与室外建筑地点关联。

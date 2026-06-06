# 数据格式规范

项目采用两层地图：

1. 室外总地图：大型建筑物和重要室外目标之间的导航。
2. 建筑室内地图：房间、厕所、服务台等目标之间的导航。

室外和室内区域统一采用区域文件夹、`area.json` 和图片像素坐标。

## 1. 区域目录

```text
data/areas/
├── index.json
└── outdoor-xianlin/
    ├── map.png
    └── area.json
```

规则：

- 一个区域对应一个文件夹。
- 一个区域只能有一张正式标注底图 `map.png`。
- 地点和路径统一写入 `area.json`。
- 正式区域目录只保留 `map.png` 和 `area.json`；阶段备份放在项目外或单独工作目录。
- 查询时先访问 `data/areas/index.json`，再按需加载目标区域。

## 2. 区域索引

`data/areas/index.json`：

```json
{
  "version": 1,
  "defaultOutdoorAreaId": "outdoor-xianlin",
  "areas": [{
    "id": "outdoor-xianlin",
    "name": "南京大学仙林校区室外总图",
    "type": "outdoor",
    "path": "data/areas/outdoor-xianlin/area.json"
  }]
}
```

索引只负责定位区域，不保存完整路径数据。

## 3. 区域正式数据

室外正式数据位于：

```text
data/areas/outdoor-xianlin/area.json
```

必须包含：

```ts
{
  version: 2;
  areaId: string;
  name: string;
  layer: 'outdoor' | 'indoor';
  coordinateSystem: 'image-pixel';
  image: {
    path: 'map.png';
    width: number;
    height: number;
    metersPerPixel: number;
  };
  places: Place[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  links: AreaLink[];
}
```

完整说明见 `docs/path-data-format.md`。

## 4. 地点 `places`

地点是用户可以搜索或点击的目标。

```json
{
  "id": "target-south-gate",
  "type": "place",
  "label": "南门（正门）",
  "routeNodeId": "gate-south",
  "x": 2200,
  "y": 5900,
  "reviewStatus": "reviewed"
}
```

要求：

- 室外地点只使用 `x/y`，禁止使用 `lat/lng`。
- `x/y` 始终是图片原始像素坐标：左上角为原点，`y` 向下增大；地图框架所需的纵轴转换只允许在渲染层完成。
- `type` 固定为 `place`。校门、建筑、食堂等含义统一写在 `label`，不再设置地点子类型。
- `routeNodeId` 必须指向可用于寻路的节点。
- 建筑地点应带 `buildingId`。
- 总地图不收录楼内厕所、饮水机、教室等细碎目标。

## 5. 路径节点 `nodes`

```json
{
  "id": "road-center",
  "type": "node",
  "x": 2050,
  "y": 3100
}
```

节点应放在：

- 道路交叉口
- 道路分叉
- 明显转折
- 校门
- 建筑入口附近

弯路必须在明显转折处添加节点，再用多条边逐段连接。

所有路径节点的 `type` 固定为 `node`。节点只保存自动生成的 `id` 和 `x/y`，不使用 `label` 或 `connections`。

## 6. 边 `edges`

```json
{
  "id": "edge-road-center-road-north",
  "from": "road-center",
  "to": "road-north",
  "type": "edge",
  "walkable": true,
  "reviewStatus": "draft"
}
```

`edge` 表示两个节点之间可直接通行的一段。所有边的 `type` 固定为 `edge`，只使用 `from/to` 建立拓扑，不保存 `path` 或 `label`。

## 7. 运行时接口

室外 `GraphNode`：

```ts
{
  id: string;
  type: 'node';
  x: number;
  y: number;
  metersPerPixel: number;
  floor: 0;
}
```

正式区域数据不得包含 `lat/lng`；不同区域之间通过显式区域连接关系对接。

`SearchItem`：

```ts
{
  id: string;
  label: string;
  type: 'building' | 'outdoor-target' | 'room' | 'facility' | 'custom';
  routeNodeId: string;
  x?: number;
  y?: number;
  buildingId?: string;
  floor: number;
}
```

## 8. 标注与直接使用

打开：

```text
http://localhost:8080/tools/path-editor.html
```

工具可以：

- 导入 `map.png`
- 添加像素节点
- 点击两个已有节点创建边
- 分别添加 `place` 和 `node`；创建 `place` 时自动生成对应路网节点
- 导入已有 `area.json` 继续编辑
- 直接导出程序可加载的版本 2 区域 JSON

导出的 JSON 不再需要坐标转换。人工审核后可以直接替换区域 `area.json`。

## 9. 唯一区域数据入口

旧式室外目标、节点、路径文件已经删除。每个区域只允许通过 `data/areas/index.json` 注册一个 `area.json`，网站和校验脚本均只读取该入口。

## 10. 数据验证

每次修改后运行：

```powershell
npm.cmd run validate:data
```

脚本会检查：

- 区域索引和区域文件是否存在。
- `map.png` 是否存在。
- 图片宽高和 `metersPerPixel` 是否有效。
- 正式室外区域是否只使用 `x/y`。
- ID 是否唯一。
- 边端点是否存在、边两端是否能够直接通行。
- 地点是否能接入路径网络。
- 示例路线是否可达。

出现致命问题时不能合并。主演示路线涉及的边应全部审核为 `reviewed`。

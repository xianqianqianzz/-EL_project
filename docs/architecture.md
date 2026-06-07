# 项目架构

## 数据边界

每个区域独占一个文件夹：

```text
data/areas/<area-id>/
├─ map.png
└─ area.json
```

`data/areas/index.json` 是区域注册表。网站先读取注册表，再加载默认室外区域的 `area.json`。不得在运行时代码中硬编码某个区域文件。

## 运行流程

1. `DataLoader` 加载区域索引与 `area.json`。
2. `OutdoorMap` 使用 Leaflet `CRS.Simple` 将 `map.png` 作为像素坐标底图。
3. `OutdoorGraphBuilder` 将 `nodes` 和 `edges` 构造成图。
4. 搜索框只索引 `places`；地图选择模式可选择全部 `nodes`。
5. A* 根据边连接关系规划路径，距离按 `像素距离 × metersPerPixel` 计算。
6. `PathRenderer` 在图片坐标上绘制规划结果。

## 两层地图

- 室外层：地点是大型建筑和重要户外设施，规划地点之间的路径。
- 室内层：未来每栋建筑或每层作为独立区域，地点是房间、厕所等，入口通过 `links` 与室外地点连接。

室内区域也应遵守“一张图片 + 一个 area.json”，不要重新引入分散的 buildings/nodes/paths 文件。

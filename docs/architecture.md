# 项目架构

## 第 1 阶段技术结构

```text
浏览器
  ├─ 现有 Leaflet 地图前端
  └─ /api/v1 区域只读接口
          │
       FastAPI
          │
  data/areas/<area-id>/
    ├─ area.json
    └─ map.png
```

- 前端暂时保留原生 HTML、CSS、JavaScript 和 Leaflet，避免重写导致地图能力回退。
- 后端使用 FastAPI，负责版本化 API、静态前端托管和未来业务能力的接入点。
- 业务数据库使用 SQLAlchemy 2.0，当前本地实现为 SQLite，并使用 Alembic 管理结构迁移。
- `area.json` 是唯一地图数据源；前端和后端不得维护第二份地点或路网数据。
- 当前尚未引入数据库、登录、行程和修改申请，这些属于后续阶段。

## 数据边界

每个区域独占一个文件夹：

```text
data/areas/<area-id>/
├─ map.png
└─ area.json
```

`data/areas/index.json` 是区域注册表。不得在运行时代码中硬编码某个区域文件。

后端启动时，前端优先读取 `/api/v1/areas`；纯静态启动时自动回退到 `data/areas/index.json`。两种方式最终读取同一份正式 `area.json`。

## 运行流程

1. `DataLoader` 优先通过 API 加载区域索引与 `area.json`，不可用时回退到静态文件。
2. `OutdoorMap` 使用 Leaflet `CRS.Simple` 将 `map.png` 作为像素坐标底图。
3. `OutdoorGraphBuilder` 将 `nodes` 和 `edges` 构造成图。
4. 搜索框只索引 `places`；地图选择模式可选择全部 `nodes`。
5. A* 根据边连接关系规划路径，距离按 `像素距离 × metersPerPixel` 计算。
6. `PathRenderer` 在图片坐标上绘制规划结果。

## 后端边界

- `AreaRepository` 是区域文件的唯一后端读取入口，负责限制路径范围并检查索引与 `areaId` 一致性。
- `/api/v1` 是正式接口前缀。已发布接口不可直接改变含义；不兼容修改应新增版本。
- 后端当前只读地图数据，不允许通过普通用户接口直接覆盖主 `area.json`。
- 用户修改申请未来必须保存为独立申请记录，经工作人员批准后才合并到主区域数据。

## 身份与权限

- 用户密码使用 Argon2 哈希保存。
- 登录成功后签发短期 JWT access token；受保护接口根据 token 用户 ID 重新查询数据库。
- 角色固定为 `user`、`staff`、`admin`。公开注册只能创建 `user`。
- 权限判断集中在后端依赖中，前端显示状态不能作为权限依据。

## 行程与路线估时

- 行程表只引用正式区域和地点 ID，不复制地点坐标或整条路径。
- `RouteService` 从当前 `area.json` 构造可通行图，并使用 Dijkstra 计算最短距离。
- 当天行程由后端按 `Asia/Shanghai` 展开，前端只负责显示和定时刷新状态。
- 建议出发时间和提醒状态由后端统一计算，避免客户端时钟或实现差异导致结果不一致。

接口字段与错误规则见 [api-contract.md](api-contract.md)。

## 两层地图

- 室外层：地点是大型建筑和重要户外设施，规划地点之间的路径。
- 室内层：未来每栋建筑或每层作为独立区域，地点是房间、厕所等，入口通过 `links` 与室外地点连接。

室内区域也应遵守“一张图片 + 一个 area.json”，不要重新引入分散的 buildings/nodes/paths 文件。

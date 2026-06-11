# API 接口契约

## 示例日程初始化

`POST /api/v1/trips/demo`

- 需要登录。
- 仅当当前账号没有任何日程时创建三条示例日程。
- 已有日程时返回空数组，不覆盖用户数据。
- 登录页在登录成功后调用一次，用于首次体验。

## 总则

- 正式前缀：`/api/v1`
- 数据格式：UTF-8 JSON
- 地图数据源：`data/areas/<area-id>/area.json`
- 错误响应：`{"detail": "可读错误说明"}`
- 不兼容修改不得直接破坏 `/api/v1`，应新增接口版本。

## 系统状态

### `GET /api/v1/health`

用于部署检查，不依赖地图区域。

```json
{
  "status": "ok",
  "service": "nju-campus-map-api",
  "apiVersion": "v1"
}
```

## 区域列表

### `GET /api/v1/areas`

返回可访问区域及其公开 API 地址。不会暴露服务器文件路径。

```json
{
  "version": 1,
  "defaultOutdoorAreaId": "outdoor-xianlin",
  "areas": [
    {
      "id": "outdoor-xianlin",
      "name": "南京大学仙林校区室外总图",
      "type": "outdoor",
      "buildingId": null,
      "dataUrl": "/api/v1/areas/outdoor-xianlin",
      "mapUrl": "/api/v1/areas/outdoor-xianlin/map"
    }
  ]
}
```

## 区域数据

### `GET /api/v1/areas/{area_id}`

返回对应的正式 `area.json`。响应使用 `Cache-Control: no-store`，便于标注期间刷新数据。

- `200`：返回完整区域 JSON。
- `404`：区域未在 `data/areas/index.json` 中登记。
- `500`：区域索引、JSON 或图片配置损坏。

## 区域图片

### `GET /api/v1/areas/{area_id}/map`

返回 `area.json.image.path` 指向的图片。后端会限制图片只能位于对应区域文件夹内。

## 用户注册

### `POST /api/v1/auth/register`

请求为 JSON，包含 `username`、`email`、`display_name`、`password`。公开注册固定创建 `user` 角色，响应不包含密码或密码哈希。

- `201`：注册成功。
- `409`：用户名或邮箱已使用。
- `422`：字段格式不符合要求。

## 用户登录

### `POST /api/v1/auth/token`

使用 `application/x-www-form-urlencoded` 提交 `username` 和 `password`，返回 bearer access token。

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 3600
}
```

## 当前用户

### `GET /api/v1/users/me`

请求头必须包含 `Authorization: Bearer <jwt>`。返回当前用户公开信息及角色。

- `200`：登录状态有效。
- `401`：token 缺失、无效、过期，或用户已停用。

## 权限角色

- `user`：普通注册用户。
- `staff`：未来负责审核地图修改申请。
- `admin`：未来负责系统管理。

后端使用统一角色依赖校验权限。公开注册和普通用户接口不得接受角色字段。

## 行程

所有行程接口都要求 bearer token，并且只能访问当前用户自己的行程。

### `POST /api/v1/trips`

创建行程。请求字段：

```json
{
  "title": "去图书馆自习",
  "area_id": "outdoor-xianlin",
  "from_place_id": "outdoor-xianlin-place-001",
  "to_place_id": "outdoor-xianlin-place-002",
  "start_date": "2026-06-11",
  "end_date": null,
  "latest_arrival_time": "18:00",
  "recurrence": "weekly",
  "reminder_minutes": 10
}
```

`recurrence` 只允许 `once`、`daily`、`weekly`、`monthly`。响应包含当前地图计算出的地点名称、距离和预计分钟数。

### `GET /api/v1/trips`

返回当前用户保存的全部行程。

### `PUT /api/v1/trips/{trip_id}`

完整更新当前用户的一条行程。

### `DELETE /api/v1/trips/{trip_id}`

删除当前用户的一条行程，成功返回 `204`。

### `GET /api/v1/trips/today`

按 `Asia/Shanghai` 的真实当前日期返回当天所有有效行程，包含：

- `latest_arrival_at`
- `suggested_departure_at`
- `estimated_distance_meters`
- `estimated_duration_minutes`
- `status`：`upcoming`、`leave_soon`、`leave_now` 或 `late`

## 当前明确不提供的接口

- 一键更新 GitHub。

该能力将在后续阶段单独设计安全策略，不得由普通 Web 请求直接操作代码仓库。

## 路径修改申请

所有申请接口要求 bearer token。申请补丁只能修改路网节点和边，不能覆盖完整区域文件。

### `POST /api/v1/proposals`

提交路径修改申请：

```json
{
  "area_id": "outdoor-xianlin",
  "title": "新增一条可通行路径",
  "description": "现场确认此处存在可通行道路，请审核。",
  "changes": {
    "add_nodes": [
      { "id": "proposal-node-001", "type": "node", "x": 120, "y": 240 }
    ],
    "add_edges": [
      {
        "id": "proposal-edge-001",
        "type": "edge",
        "from": "outdoor-xianlin-node-001",
        "to": "proposal-node-001",
        "walkable": true
      }
    ],
    "remove_edge_ids": []
  }
}
```

后端提交时会预检补丁，但不会修改正式地图。

### `GET /api/v1/proposals/mine`

返回当前用户提交的申请及审核状态。

### `GET /api/v1/proposals`

仅 `staff/admin` 可访问，返回审核队列和历史申请。

### `POST /api/v1/proposals/{proposal_id}/approve`

仅 `staff/admin` 可访问。填写审核意见后，系统基于当前最新正式区域重新应用补丁、完整校验并原子写入。

### `POST /api/v1/proposals/{proposal_id}/reject`

仅 `staff/admin` 可访问。填写拒绝原因并保留审核记录。

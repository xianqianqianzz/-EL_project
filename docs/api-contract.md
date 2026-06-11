# API 接口契约

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

## 当前明确不提供的接口

- 注册、登录与用户资料。
- 行程增删改查与提醒。
- 用户路径修改申请。
- 工作人员审核与直接修改主地图。
- 一键更新 GitHub。

这些能力必须在后续阶段单独设计权限、数据库结构和审核流程，不得临时塞入区域只读接口。

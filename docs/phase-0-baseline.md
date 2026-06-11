# 第 0 阶段基线

第 0 阶段只负责稳定现有静态地图项目，不包含 React、后端、数据库、登录或行程功能。

## 固定范围

- 地图数据仍使用 `data/areas/<area-id>/map.png + area.json`。
- 当前默认区域为 `outdoor-xianlin`。
- 当前前端仍为原生 HTML、CSS、JavaScript 和 Leaflet。
- 正式文本文件统一使用 UTF-8 无 BOM，Git 中统一使用 LF 换行。

## 自动检查

本地与 GitHub Actions 使用同一条命令：

```bash
npm run check
```

该命令检查：

1. 文本文件为有效 UTF-8 且没有 BOM。
2. JavaScript 文件通过语法检查。
3. `area.json` 的地点、节点、边和图片引用符合规范。
4. 不存在重复坐标节点、重复边、自环边或孤立节点。
5. 每个地点均连接路网，默认起点可到达其他所有地点。

## 当前验收基线

```text
122 places
520 nodes
708 edges
0 isolated nodes
南大门可到达其余 121/121 个地点
```

后续修改若无法通过 `npm run check`，不得合并到正式分支。

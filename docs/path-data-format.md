# 路网格式说明

路网由 `nodes` 和 `edges` 构成。

- 节点表示道路交叉口、转折点、地点接入点。
- 边表示两个节点之间可以直接步行通过。
- 当前边在地图上显示为两节点之间的直线；道路弯曲时，应在弯折处增加中间节点，再分段连边。
- 不要把整条道路画成自由折线，也不要在节点里维护 `connections`。

边示例：

```json
{
  "id": "outdoor-xianlin-edge-001",
  "from": "outdoor-xianlin-node-001",
  "to": "outdoor-xianlin-node-008",
  "type": "edge",
  "walkable": true,
  "reviewStatus": "draft"
}
```

`reviewStatus` 建议使用 `draft`、`needs-review`、`reviewed`。当前校验会提示尚未复核的 draft 边。

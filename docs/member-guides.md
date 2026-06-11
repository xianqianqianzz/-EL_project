# 四人协作指南

## 推荐分工

| 成员 | 主要责任 | 独立交付物 |
|---|---|---|
| A | 区域底图与地点标注 | `map.png`、`places`、地点命名表 |
| B | 路网节点与边标注 | `nodes`、`edges` |
| C | 数据复核与连通性测试 | 复核后的 `area.json`、问题清单 |
| D | 前后端功能、接口与文档 | `js/`、`backend/`、校验脚本、说明文档 |

## 依赖关系

A 必须先固定底图尺寸，并完成主要地点；B 才能稳定标路网。C 在 A/B 每完成一个小区域后即可分批复核，不必等全部结束。D 只依赖正式格式和一份可运行样例，可与标注并行开发。

## 降低互相阻塞

- 先共同确认 `area.json` 规范，此后不私自新增字段。
- A/B 使用同一张 `map.png`，不得各自重新导出图片。
- 按地理小区域分批交付，每批都可独立校验和合并。
- C 只修改 `reviewStatus` 和确认的问题，不直接重画大段路网。
- D 通过 `data/areas/index.json` 接入区域，不写区域专用代码。

## 第 1 阶段独立工作边界

| 成员 | 可独立修改的主要范围 | 提交前必须执行 |
|---|---|---|
| A | `places` 与地点名称，不修改 `nodes/edges` | `npm.cmd run validate:data` |
| B | `nodes/edges`，不修改后端接口 | `npm.cmd run validate:data` |
| C | 数据审核状态、问题清单、数据校验脚本 | `npm.cmd run check` |
| D | `backend/`、`js/`、`css/`、接口和架构文档 | `npm.cmd run check` |

共同文件 `data/areas/<area-id>/area.json` 容易产生 Git 冲突。A、B、C 应按小区域串行合并该文件，但图片、问题清单、校验脚本和前后端代码仍可并行。任何人不得通过后端生成另一份正式地图数据。

## 阶段提交规则

1. 日常工作提交到成员分支或 `development`。
2. 阶段结束时运行 `npm.cmd run check`。
3. 检查通过并经负责人批准后，合并到 `master` 并推送 GitHub。
4. 不得使用强制推送覆盖 `master`。

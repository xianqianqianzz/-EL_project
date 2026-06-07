# 项目上下文

这是南京大学校园地图项目。当前正式数据接口为“一个区域、一张底图、一个 area.json”。

## 不可破坏的约束

- 区域索引：`data/areas/index.json`
- 区域目录：`data/areas/<area-id>/map.png` 与 `area.json`
- 坐标：图片原始像素坐标 `image-pixel`
- 对象类型：只允许 `place`、`node`、`edge`
- `node` 不保存标签或 connections
- `edge` 不保存自由折线，使用 from/to 引用节点
- 网站搜索只展示 place；地图选择模式展示全部 node
- 室外距离为节点像素距离乘 `image.metersPerPixel`

修改数据格式、标注工具或运行时代码时，必须同步更新 `README.md` 和 `docs/` 中对应说明，并运行：

```powershell
npm run validate:data
```

当前演示区域 `outdoor-xianlin` 应满足：2 places、14 nodes、17 edges；南大门到图书馆为 9 nodes、约 222 m。

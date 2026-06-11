# 南京大学校园地图

项目使用“一个区域文件夹对应一张地图图片和一个 `area.json`”的数据形式。当前演示区域为仙林校区室外总图。

## 启动

在项目根目录启动静态服务器：

```powershell
python -m http.server 8080
```

打开 `http://localhost:8080/index.html`。标注工具位于 `http://localhost:8080/tools/path-editor.html`。

网站加载区域 JSON 时会主动绕过浏览器缓存。更新 `area.json` 后刷新页面即可看到最新地点和节点；普通路网节点仅在点击“选择起点/终点”后显示。

运行数据校验：

```powershell
npm run validate:data
```

提交或创建 Pull Request 前运行完整基线检查：

```powershell
npm run check
```

GitHub Actions 会对 Pull Request 和正式分支推送执行同一套检查。第 0 阶段验收范围见 [docs/phase-0-baseline.md](docs/phase-0-baseline.md)。

## 当前数据

```text
data/
└─ areas/
   ├─ index.json
   └─ outdoor-xianlin/
      ├─ map.png
      └─ area.json
```

- `map.png` 是该区域唯一的标注底图。
- `area.json` 同时保存地点、路网节点和边。
- 所有坐标都是底图原始尺寸上的图片像素坐标，不使用经纬度。
- `place` 是用户可搜索地点，必须绑定一个 `routeNodeId`。
- `node` 只是路网节点，不需要标签。
- `edge` 连接两个节点，不保存自由折线。
- 网站默认常驻显示 `place` 圆点，地点名称在悬停时显示；普通 `node` 仅在“选择起点/终点”模式中显示。

详细规范见 [docs/data-format.md](docs/data-format.md) 和 [docs/path-data-workflow.md](docs/path-data-workflow.md)。

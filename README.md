# 南京大学智能校园地图

面向南京大学的智能校园地图系统，支持室外校园导航与大建筑物内精细到走廊的室内路径规划。

## 技术栈

- **前端**：HTML / CSS / JavaScript（原生）
- **地图**：[Leaflet.js](https://leafletjs.com/) 1.9.4
- **路径规划**：A* 算法（自实现）
- **室内渲染**：Canvas API

## 项目结构

```
nju-campus-map/
├── index.html              # 主页面
├── css/                    # 样式
├── js/
│   ├── app.js              # 应用入口
│   ├── config.js           # 全局配置
│   ├── map/                # 地图渲染 (A)
│   ├── nav/                # 路径规划 (B)
│   ├── ui/                 # 界面交互 (C)
│   └── data/               # 数据加载
├── data/                   # 地图数据 (D)
│   ├── buildings.json
│   ├── outdoor-nodes.json
│   ├── poi.json
│   └── indoor/
├── docs/                   # 文档
└── README.md
```

## 快速开始

用任意 HTTP 服务器启动（因为需要 fetch 加载 JSON 数据）：

```bash
# Python 3
python -m http.server 8080

# 或 Node.js
npx serve .
```

然后访问 `http://localhost:8080`

## 四人分工

| 角色 | 负责模块 | 目录 |
|------|----------|------|
| 🅰️ 地图渲染 | 室外/室内地图显示 | `js/map/` |
| 🅱️ 路径规划 | A*算法 + 图结构 | `js/nav/` |
| 🅲️ UI/交互 | 搜索、面板、控件 | `js/ui/` + `css/` |
| 🅳️ 数据/文档 | 校园数据 + 文档 | `data/` + `docs/` |

## 开发流程

1. 各自在自己的分支开发
2. 功能完成后提 PR 到 main
3. 代码审查后合并

## 分支

- `main` — 稳定版本
- `map-render` — A 开发
- `path-planning` — B 开发
- `ui-interaction` — C 开发
- `data-docs` — D 开发

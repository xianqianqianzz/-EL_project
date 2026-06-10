# 前端开发日志

## 项目：南京大学校园地图（-EL_project）

---

### 2026-06-08 — UI 界面初始化

**状态：** 已完成

**内容：**
- 基于 NJU 紫色系（#4a3f7a）重设计整体视觉
- 重构 index.html 结构：header-inner 居中布局、logo 图标+文字、空状态面板含 SVG 搜索图标
- 重写 css/main.css：完整设计系统（颜色变量、间距、过渡动画、响应式断点 900px/480px）
- 优化 css/map.css：地点标记 20px、hover 缩放、start/end 标记配色匹配主色系
- 更新 css/indoor.css：统一室内地图工具栏和楼层选择器配色

**文件改动：**
- index.html — 结构优化
- css/main.css — 全新设计系统
- css/map.css — 标记样式优化
- css/indoor.css — 配色统一

**保留约束：** 所有 JS 依赖的 DOM ID 和 class 名未变，现有功能不受影响。

---

### 2026-06-08 — 后端接口梳理

**状态：** 规划中，未实现

**分析：** 当前前端通过 DataLoader.loadJSON() 直接 fetch 静态 JSON 文件，无接口抽象层。

**需预留的后端接口：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/areas | 区域列表 |
| GET | /api/areas/:id | 区域详情（places, nodes, edges） |
| GET | /api/search?q=xxx | 地点搜索 |
| POST | /api/route | 路线计算（from, to） |
| GET | /api/buildings/:id | 建筑物室内数据 |
| GET | /api/buildings/:id/floors/:floor | 单层平面图 |

**前端待做：** 新建 js/api.js 作为统一数据访问层，隔离静态加载与后端调用。

---


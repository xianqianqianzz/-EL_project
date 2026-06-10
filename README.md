# 南京大学校园地图

南京大学仙林校区 / 鼓楼校区校园导航地图，支持室外路径规划与室内建筑平面图查看。

## 快速启动

 + "" + "" + "" + powershell
git clone https://github.com/xianqianqianzz/-EL_project.git
cd -EL_project
python -m http.server 8080
 + "" + "" + "" + 

浏览器打开  + "" + http://localhost:8080/index.html + "" +  即可使用。

路径编辑器： + "" + http://localhost:8080/tools/path-editor.html + "" + 

## 数据校验

 + "" + "" + "" + powershell
npm run validate:data
 + "" + "" + "" + 

## 工作流

 + "" + "" + "" + 
0. cd -EL_project
1. git checkout development
2. git checkout -b A/B/C/D    # 建立自己的工作分支
3. 完成后 git add / git commit
4. git checkout development && git pull origin development
5. git merge A/B/C/D
6. git push origin development
 + "" + "" + "" + 

## 角色分工

| 角色 | 负责内容 | 依赖 |
|------|------|--------|
| A | 地图视觉与交互 | map.png、places |
| B | 路网数据标注 | nodes、edges |
| C | 数据审核与校验 | 已有 area.json 基础数据 |
| D | 前端功能开发 | 前端页面 |

C 负责 reviewStatus 字段的审核确认。

## 数据目录

 + "" + "" + "" + 
data/areas/
├── index.json
├── outdoor-xianlin/
│   ├── map.png         # 4252×6378
│   ├── area.json       # v2, image-pixel 坐标
├── outdoor-gulou/
    ├── map.png         # 鼓楼校区
 + "" + "" + "" + 

### 仙林校区数据规模

| 指标 | 数量 |
|------|------|
| 地点 | 122 |
| 路网节点 | 521 |
| 边 | 706（已 review） |
| 标注完成度 | 120 / 122 |

路网数据由标注工具逐节点标注完成，A/B 角色协作。

## 数据规范

-  + "" + map.png + "" +  是标注底图，所有坐标基于该图像像素。
-  + "" + rea.json + "" +  为单一数据源，包含全部节点、边、地点。
- 坐标系统为 image-pixel，原点在图像左上角。
-  + "" + place + "" +  表示地图上的可搜索地点，必须绑定  + "" + outeNodeId + "" + 。
-  + "" + 
ode + "" +  含字段 id, type, x, y，可选 label。
-  + "" + edge + "" +  含字段 id, type, from, to, walkable, reviewStatus，权重自动计算。

详见 [docs/data-format.md](docs/data-format.md) 与 [docs/path-data-workflow.md](docs/path-data-workflow.md)。

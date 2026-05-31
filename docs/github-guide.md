# GitHub 协作开发指南

> 写给零 GitHub 经验的团队，从零开始的协作流程

## 一、前置准备

### 1. 每人注册 GitHub 账号
访问 https://github.com 注册，记住用户名和邮箱。

### 2. 安装 Git
- **Windows**: 下载 [Git for Windows](https://git-scm.com/download/win)
- **Mac**: `brew install git` 或下载安装包
- 安装后打开终端（CMD/PowerShell），配置：
```bash
git config --global user.name "你的名字"
git config --global user.email "你的GitHub邮箱"
```

### 3. 队长（D）创建仓库

1. 登录 GitHub → 右上角 "+" → "New repository"
2. Repository name: `nju-campus-map`
3. 选择 **Public**（或 Private，然后邀请组员）
4. **不要**勾选 "Add a README file"（我们已有）
5. 点击 "Create repository"

### 4. 推送本地代码到 GitHub

```bash
cd D:/ELproject/nju-campus-map
git init
git add .
git commit -m "初始化项目骨架：架构搭建、模块接口定义、示例数据"
git branch -M main
git remote add origin https://github.com/你的用户名/nju-campus-map.git
git push -u origin main
```

### 5. 邀请组员
仓库页面 → Settings → Collaborators → Add people → 输入组员 GitHub 用户名

## 二、每人克隆仓库

```bash
# 在自己电脑上
git clone https://github.com/队长用户名/nju-campus-map.git
cd nju-campus-map
```

## 三、创建开发分支

每人创建自己的开发分支：

```bash
# A - 地图渲染
git checkout -b map-render
git push -u origin map-render

# B - 路径规划
git checkout -b path-planning
git push -u origin path-planning

# C - UI/交互
git checkout -b ui-interaction
git push -u origin ui-interaction

# D - 数据/文档
git checkout -b data-docs
git push -u origin data-docs
```

## 四、日常开发流程（每天重复）

```bash
# === 每天开始工作前 ===

# 1. 切换到 main 并拉取最新
git checkout main
git pull

# 2. 切回自己的分支，合并 main 的更新
git checkout map-render   # 换成你自己的分支名
git merge main

# === 开发中 ===

# 3. 写代码...

# 4. 查看改了什么
git status
git diff

# 5. 提交（小步提交，每完成一个小功能就提交一次）
git add js/map/outdoor.js   # 只加你改的文件，不要 git add .
git commit -m "feat(map): 添加建筑轮廓点击高亮效果"

# === 每天结束前 ===

# 6. 推送到 GitHub
git push origin map-render   # 换成你自己的分支名
```

## 五、提交信息规范

用英文或中文都可以，关键是格式统一：

```
feat(模块): 简短描述做了什么

fix(模块): 修复了什么bug

docs: 更新文档

refactor(模块): 重构了什么
```

示例：
- `feat(map): 实现室内楼层Canvas渲染`
- `feat(nav): A*算法支持跨楼层寻路`
- `fix(ui): 修复搜索框下拉菜单闪烁`
- `docs: 添加室内数据格式文档`

## 六、合并代码到 main（Pull Request）

当你完成一个完整功能，可以把代码合并到 main：

1. 先确保你的分支已推送到 GitHub：
   ```bash
   git push origin map-render
   ```

2. 打开 GitHub 仓库页面 → "Pull requests" → "New pull request"

3. base 选 `main`，compare 选你的分支（如 `map-render`）

4. 点 "Create pull request"，写标题和说明

5. 让队长或其他组员 Review

6. 确认无误后点 "Merge pull request"

7. **合并后**，通知所有人拉取最新 main：
   ```bash
   git checkout main && git pull
   ```

## 七、常见问题处理

### 冲突怎么办？
```bash
# 合并 main 时若提示 CONFLICT
git merge main
# 打开冲突文件，找到 <<<<<<< ======= >>>>>>> 标记
# 手动选择保留哪部分代码，删掉标记
git add 冲突文件
git commit -m "merge: 解决与main的冲突"
```

### 不小心改错了？
```bash
# 丢弃单个文件的修改
git checkout -- 文件名

# 丢弃所有未提交的修改（危险！）
git checkout .
```

### 提交错了想撤销？
```bash
# 撤销最近一次提交（保留文件修改）
git reset --soft HEAD~1
```

### 查看谁改了什么？
```bash
git log --oneline --graph --all
```

## 八、检查点看板建议

在 GitHub 仓库页面 → Projects → 创建看板，建议列：

| 待开始 | 进行中 | 待审查 | 已完成 |
|--------|--------|--------|--------|
| 任务卡片 | 当前任务 | PR 等待 | 已合并 |

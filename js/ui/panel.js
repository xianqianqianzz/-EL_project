/**
 * 信息面板模块
 * 管理左侧信息面板的显示和切换
 */
class InfoPanel {
  constructor() {
    this.emptySection = document.getElementById('panel-empty');
    this.routeSection = document.getElementById('panel-route');
    this.buildingSection = document.getElementById('panel-building');
  }

  showRoute(routeResult) {
    this._hideAll();
    this.routeSection.classList.remove('hidden');

    const dist = routeResult.totalDistance;
    const timeMin = Math.round(dist / CONFIG.walkingSpeed / 60);
    this.routeSection.querySelector('.route-dist').textContent =
      dist < 1000 ? `${Math.round(dist)} 米` : `${(dist/1000).toFixed(1)} 公里`;
    this.routeSection.querySelector('.route-time').textContent =
      timeMin < 1 ? '< 1 分钟' : `约 ${timeMin} 分钟`;

    // 分段信息
    const segs = PathRenderer.segmentPath(routeResult.path);
    const segContainer = this.routeSection.querySelector('.route-segments');
    segContainer.innerHTML = '';
    for (const seg of segs) {
      const div = document.createElement('div');
      if (seg.type === 'outdoor') {
        div.textContent = `🌳 室外步行 · ${seg.nodes.length} 个路点`;
      } else {
        const floorLabel = seg.floor <= 0 ? `B${-seg.floor}` : `${seg.floor}F`;
        div.textContent = `🏢 室内 · ${floorLabel} · ${seg.nodes.length} 个节点`;
      }
      segContainer.appendChild(div);
    }

    // 步骤列表
    const stepsEl = this.routeSection.querySelector('.route-steps');
    stepsEl.innerHTML = '';
    for (let i = 0; i < routeResult.path.length; i++) {
      const n = routeResult.path[i];
      const li = document.createElement('li');
      const nodeLabel = n.label || n.id;
      if (i === 0) li.textContent = `起点：${routeResult.fromLabel || nodeLabel}`;
      else if (i === routeResult.path.length - 1) li.textContent = `终点：${routeResult.toLabel || nodeLabel}`;
      else if (n.type === 'stair') li.textContent = `走楼梯至 ${n.label}`;
      else if (n.type === 'elevator') li.textContent = `乘电梯至 ${n.label}`;
      else if (n.type === 'entrance') li.textContent = `进入 ${n.label}`;
      else if (n.floor === 0) li.textContent = '沿已标注边前行';
      else li.textContent = `沿${nodeLabel}前行`;
      stepsEl.appendChild(li);
    }
  }

  showBuilding(building) {
    this._hideAll();
    this.buildingSection.classList.remove('hidden');
    this.buildingSection.querySelector('.building-name').textContent = building.name;
    this.buildingSection.querySelector('.building-desc').textContent =
      building.description || '';
    const btn = this.buildingSection.querySelector('#btn-enter-building');
    btn.onclick = () => {
      if (this._onEnterBuilding) this._onEnterBuilding(building);
    };
    if (!building.indoorAvailable) btn.style.display = 'none';
    else btn.style.display = 'block';
  }

  showEmpty() {
    this._hideAll();
    this.emptySection.classList.remove('hidden');
  }

  _hideAll() {
    this.emptySection.classList.add('hidden');
    this.routeSection.classList.add('hidden');
    this.buildingSection.classList.add('hidden');
  }

  onEnterBuilding(fn) { this._onEnterBuilding = fn; }
}

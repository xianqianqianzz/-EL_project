/**
 * 图层切换控制器
 * 管理室外地图 ↔ 室内地图的切换和状态
 */
class LayerSwitch {
  constructor(outdoorMap, indoorMap) {
    this.outdoor = outdoorMap;
    this.indoor = indoorMap;
    this.mode = 'outdoor';         // 'outdoor' | 'indoor'
    this.currentBuilding = null;   // 当前进入的建筑对象
    this.currentFloor = 1;

    /** @type {Function|null} 图层切换回调 */
    this._onSwitch = null;
  }

  /**
   * 进入室内地图
   * @param {Object} building  - 建筑对象 { id, name, floors, ... }
   * @param {Object} indoorData - 室内数据 { floors, nodes, edges, ... }
   * @param {number} [floor=1]  - 进入显示的楼层
   */
  enterIndoor(building, indoorData, floor) {
    this.mode = 'indoor';
    this.currentBuilding = building;
    this.currentFloor = floor || 1;

    document.getElementById('outdoor-map').classList.add('hidden');
    document.getElementById('indoor-map').classList.remove('hidden');

    document.querySelector('.indoor-title').textContent = building.name;
    this.indoor.loadBuilding(building.id, indoorData);
    this.indoor.switchFloor(this.currentFloor);

    // 渲染楼层选择器
    this._renderFloorSelector(building.floors || indoorData.floors);

    // 更新信息面板
    if (this._onSwitch) this._onSwitch('indoor', building);
  }

  exitToOutdoor() {
    this.mode = 'outdoor';
    this.currentBuilding = null;

    document.getElementById('outdoor-map').classList.remove('hidden');
    document.getElementById('indoor-map').classList.add('hidden');

    // 触发地图 resize（Leaflet 在 hidden 变 visible 时需要）
    setTimeout(() => this.outdoor.map.invalidateSize(), 100);

    if (this._onSwitch) this._onSwitch('outdoor', null);
  }

  _renderFloorSelector(floors) {
    const container = document.getElementById('floor-selector');
    if (!container) return;
    container.innerHTML = '';

    // floors 可能是 [1,2,3] 或 [{ level:1, label:'1F' }, ...]
    const levels = floors.map(f => typeof f === 'number' ? f : f.level || f);
    levels.sort((a, b) => a - b);

    for (const lv of levels) {
      const btn = document.createElement('button');
      btn.className = 'floor-btn' + (lv === this.currentFloor ? ' active' : '');
      btn.textContent = lv <= 0 ? `B${-lv}` : `${lv}F`;
      btn.addEventListener('click', () => {
        this.currentFloor = lv;
        this.indoor.switchFloor(lv);
        this._renderFloorSelector(levels);
      });
      container.appendChild(btn);
    }
  }

  onSwitch(fn) { this._onSwitch = fn; }
}

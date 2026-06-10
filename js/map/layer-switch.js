/**
 * 图层切换控制器
 * 管理室外地图 / 室内地图的切换和状态
 */
class LayerSwitch {
  constructor(outdoorMap, indoorMap) {
    this.outdoor = outdoorMap;
    this.indoor = indoorMap;
    this.mode = 'outdoor';
    this.currentBuilding = null;
    this.buildings = [];
    this._onSwitch = null;
  }

  /**
   * 加载建筑注册表
   * @param {Array} buildings - buildings.json 的数据
   */
  loadBuildings(buildings) {
    this.buildings = buildings || [];
  }

  /**
   * 进入室内地图
   * @param {Object} building - 建筑对象 { id, name, floors }
   */
  enterIndoor(building) {
    if (!building) return;
    this.mode = 'indoor';
    this.currentBuilding = building;

    document.getElementById('outdoor-map').classList.add('hidden');
    document.getElementById('indoor-map').classList.remove('hidden');

    var titleEl = document.querySelector('.indoor-title');
    if (titleEl) titleEl.textContent = building.name;

    this.indoor.loadBuilding(building);
    this._renderFloorSelector();

    if (this._onSwitch) this._onSwitch('indoor', building);
  }

  exitToOutdoor() {
    this.mode = 'outdoor';
    this.currentBuilding = null;

    document.getElementById('outdoor-map').classList.remove('hidden');
    document.getElementById('indoor-map').classList.add('hidden');

    this.indoor.destroy();

    setTimeout(function() {
      if (this.outdoor && this.outdoor.map) this.outdoor.map.invalidateSize();
    }.bind(this), 100);

    if (this._onSwitch) this._onSwitch('outdoor', null);
  }

  /**
   * 通过建筑名搜索匹配的建筑
   */
  findBuildingByName(name) {
    if (!name) return null;
    var q = name.toLowerCase();
    for (var i = 0; i < this.buildings.length; i++) {
      var b = this.buildings[i];
      if (b.name.toLowerCase().indexOf(q) !== -1 || b.id.toLowerCase().indexOf(q) !== -1) {
        return b;
      }
      // Also search aliases
      var aliases = b.aliases || [];
      for (var j = 0; j < aliases.length; j++) {
        if (aliases[j].toLowerCase().indexOf(q) !== -1) {
          return b;
        }
      }
    }
    return null;
  }

  _renderFloorSelector() {
    var container = document.getElementById('floor-selector');
    if (!container) return;
    container.innerHTML = '';

    var floorCount = this.indoor.getFloorCount();
    if (floorCount <= 1) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';

    var self = this;
    for (var i = 0; i < floorCount; i++) {
      var floor = this.currentBuilding.floors[i];
      var btn = document.createElement('button');
      btn.className = 'floor-btn' + (i === this.indoor.currentFloorIdx ? ' active' : '');
      btn.textContent = (floor.level || '') + 'F';
      (function(idx) {
        btn.addEventListener('click', function() {
          self.indoor.switchFloor(idx);
          self._renderFloorSelector();
        });
      })(i);
      container.appendChild(btn);
    }
  }

  onSwitch(fn) { this._onSwitch = fn; }
}

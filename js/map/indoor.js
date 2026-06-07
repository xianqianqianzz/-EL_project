/**
 * 室内地图模块
 * 使用 Canvas 渲染单层室内平面图
 */
class IndoorMap {
  constructor(canvasId) {
    /** @type {HTMLCanvasElement} */
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    /** @type {Object|null} 当前加载的建筑室内数据 */
    this.data = null;
    this.currentFloor = 1;
    this.buildingId = null;

    // 视口偏移（用于拖拽）
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;

    this._setupDrag();
    this._onRoomClick = null;
  }

  /**
   * @param {string} buildingId
   * @param {Object} indoorData - { floors: [...], nodes: [...], edges: [...], outline: {...} }
   */
  loadBuilding(buildingId, indoorData) {
    this.buildingId = buildingId;
    this.data = indoorData;
    this.currentFloor = this._getFloorLevels()[0] ?? 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.resize();
    this.render();
  }

  switchFloor(floor) {
    this.currentFloor = floor;
    this.render();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  render(pathNodes) {
    if (!this.data) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const floorData = this._getFloorData();
    if (!floorData) return;

    ctx.save();
    ctx.translate(w/2 + this.offsetX, h/2 + this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 绘制房间
    for (const room of (floorData.rooms || [])) {
      this._drawRoom(ctx, room);
    }
    // 绘制走廊
    for (const cor of (floorData.corridors || [])) {
      this._drawCorridor(ctx, cor);
    }
    // 绘制楼梯/电梯
    for (const v of (floorData.verticals || [])) {
      this._drawVertical(ctx, v);
    }
    // 绘制节点
    for (const n of (this.data.nodes || [])) {
      if (n.floor === this.currentFloor) {
        this._drawNode(ctx, n);
      }
    }

    ctx.restore();

    // 绘制路径（如果有）
    if (pathNodes) {
      this._drawPath(pathNodes);
    }
  }

  /** 坐标转换：经纬度 → Canvas x,y */
  latlngToXY(node) {
    if (!this.data || !this.data.bounds) return { x: 0, y: 0 };
    const b = this.data.bounds;
    const pxPerMeter = CONFIG.indoor.pixelsPerMeter * this.scale;
    // 简化：按比例缩放
    const x = (node.lng - b.minLng) / (b.maxLng - b.minLng) * 800 - 400;
    const y = (b.maxLat - node.lat) / (b.maxLat - b.minLat) * 600 - 300;
    return { x, y };
  }

  // --- 私有绘制方法 ---

  _getFloorData() {
    return (this.data.floors || []).find(f => {
      const level = typeof f === 'number' ? f : f.level;
      return level === this.currentFloor;
    });
  }

  _getFloorLevels() {
    return (this.data?.floors || [])
      .map(f => typeof f === 'number' ? f : f.level)
      .filter(f => typeof f === 'number')
      .sort((a, b) => a - b);
  }

  _drawRoom(ctx, room) {
    const cw = CONFIG.indoor.corridorWidth;
    ctx.fillStyle = room.color || '#f0f0f0';
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.fillRect(room.x, room.y, room.w, room.h);
    ctx.strokeRect(room.x, room.y, room.w, room.h);
    // 房间编号
    if (room.label) {
      ctx.fillStyle = '#333';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.label, room.x + room.w/2, room.y + room.h/2 + 4);
    }
  }

  _drawCorridor(ctx, cor) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(cor.x, cor.y, cor.w, cor.h);
  }

  _drawVertical(ctx, v) {
    ctx.fillStyle = v.type === 'stair' ? '#ffe0b2' : '#b2dfdb';
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const label = v.type === 'stair' ? '楼梯' : '电梯';
    ctx.fillText(label, v.x + v.w/2, v.y + v.h/2 + 4);
  }

  _drawNode(ctx, node) {
    const r = CONFIG.indoor.nodeRadius;
    ctx.fillStyle = node.type === 'room' ? '#e8734a' :
                    node.type === 'facility' ? '#8e44ad' :
                    node.type === 'stair' ? '#ff9800' :
                    node.type === 'elevator' ? '#009688' : '#4a6fa5';
    const xy = this.latlngToXY(node);
    ctx.beginPath();
    ctx.arc(xy.x, xy.y, r, 0, Math.PI*2);
    ctx.fill();
  }

  _drawPath(pathNodes) {
    const ctx = this.ctx;
    const floorNodes = pathNodes.filter(n => n.floor === this.currentFloor);
    if (floorNodes.length < 2) return;
    ctx.save();
    ctx.translate(this.canvas.width/2 + this.offsetX, this.canvas.height/2 + this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.strokeStyle = '#e8734a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const p0 = this.latlngToXY(floorNodes[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < floorNodes.length; i++) {
      const p = this.latlngToXY(floorNodes[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // --- 拖拽 ---
  _setupDrag() {
    let dragging = false, lastX, lastY;
    this.canvas.addEventListener('mousedown', e => {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      this.offsetX += e.clientX - lastX;
      this.offsetY += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      this.render();
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale *= delta;
      this.scale = Math.max(0.5, Math.min(3, this.scale));
      this.render();
    });
  }

  onRoomClick(fn) { this._onRoomClick = fn; }
}

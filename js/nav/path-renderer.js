/**
 * 路径渲染器
 * 将路径规划结果画在地图上（室外用 Leaflet polyline，室内用 Canvas）
 */
class PathRenderer {
  constructor() {
    /** @type {L.Polyline|null} 室外路径线 */
    this.outdoorLine = null;
    /** @type {L.Marker[]} 起终点标记 */
    this.markers = [];
    /** 室内 Canvas 路径缓存 */
    this.indoorSegments = [];
  }

  /**
   * 在室外地图上画路径
   * @param {L.Map} map - Leaflet 地图实例
   * @param {GraphNode[]} pathNodes - 完整路径节点序列
   */
  drawOutdoor(map, pathNodes) {
    this.clearOutdoor(map);
    const outdoorPoints = pathNodes.filter(n => n.floor === 0);
    if (outdoorPoints.length < 2) return;

    const latlngs = outdoorPoints.map(n => [n.lat, n.lng]);
    this.outdoorLine = L.polyline(latlngs, {
      color: '#4a6fa5',
      weight: 5,
      opacity: 0.8,
      dashArray: null
    }).addTo(map);

    // 起点和终点大头针
    const startIcon = L.divIcon({ className: 'marker-start', html: '📍', iconSize: [24, 24] });
    const endIcon = L.divIcon({ className: 'marker-end', html: '🎯', iconSize: [24, 24] });
    const first = pathNodes[0];
    const last = pathNodes[pathNodes.length - 1];
    this.markers.push(L.marker([first.lat, first.lng], { icon: startIcon }).addTo(map));
    this.markers.push(L.marker([last.lat, last.lng], { icon: endIcon }).addTo(map));

    // 适配视野
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [60, 60] });
  }

  clearOutdoor(map) {
    if (this.outdoorLine) { map.removeLayer(this.outdoorLine); this.outdoorLine = null; }
    for (const m of this.markers) { map.removeLayer(m); }
    this.markers = [];
  }

  /**
   * 在室内 Canvas 上画路径
   * @param {CanvasRenderingContext2D} ctx
   * @param {GraphNode[]} pathNodes - 全部路径节点
   * @param {number} floor - 当前楼层
   * @param {{ x:number, y:number } => {lat, lng}} coordFn
   */
  drawIndoor(ctx, pathNodes, floor, coordFn) {
    const floorNodes = pathNodes.filter(n => n.floor === floor);
    if (floorNodes.length < 2) return;
    ctx.save();
    ctx.strokeStyle = '#4a6fa5';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const p0 = coordFn(floorNodes[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < floorNodes.length; i++) {
      const p = coordFn(floorNodes[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    // 画节点圆点
    ctx.fillStyle = '#e8734a';
    for (const n of floorNodes) {
      const p = coordFn(n);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 将路径分段：室外段/各楼层室内段/跨层段
   * @returns {PathSegment[]}
   */
  static segmentPath(pathNodes) {
    const segs = [];
    let cur = { type: null, nodes: [] };
    for (const n of pathNodes) {
      const t = n.floor === 0 ? 'outdoor' : 'indoor';
      if (cur.type && cur.type !== t) {
        segs.push({ ...cur });
        cur = { type: t, nodes: [], floor: n.floor };
      }
      if (!cur.type) cur.type = t;
      if (t === 'indoor') cur.floor = n.floor;
      cur.nodes.push(n);
    }
    if (cur.nodes.length) segs.push(cur);
    return segs;
  }
}

/** @typedef {{ type: 'outdoor'|'indoor', nodes: GraphNode[], floor?: number }} PathSegment */

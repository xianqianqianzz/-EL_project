/**
 * 室外地图模块
 * 使用 Leaflet 渲染校园室外地图
 */
class OutdoorMap {
  constructor(containerId) {
    /** @type {L.Map} */
    this.map = L.map(containerId, {
      center: CONFIG.center,
      zoom: CONFIG.defaultZoom,
      maxZoom: CONFIG.maxZoom,
      minZoom: CONFIG.minZoom,
      zoomControl: true
    });

    L.tileLayer(CONFIG.tileUrl, {
      attribution: CONFIG.tileAttribution,
      maxZoom: CONFIG.maxZoom
    }).addTo(this.map);

    /** @type {Map<string, L.Layer>} 建筑多边形图层 */
    this.buildingLayers = new Map();
    /** @type {Map<string, L.Marker>} POI 标记 */
    this.poiMarkers = new Map();

    this._onBuildingClick = null;
    this._onMapClick = null;
  }

  /**
   * 从 buildings.json 渲染所有建筑轮廓
   * @param {Object[]} buildings
   */
  renderBuildings(buildings) {
    for (const b of buildings) {
      if (b.outline && b.outline.length > 0) {
        const latlngs = b.outline.map(p => [p.lat, p.lng]);
        const polygon = L.polygon(latlngs, {
          color: '#4a6fa5',
          weight: 2,
          fillColor: '#c8d6e5',
          fillOpacity: 0.5
        }).addTo(this.map);
        polygon.bindPopup(`<b>${b.name}</b>`);
        if (b.indoorAvailable) {
          polygon.on('click', () => {
            if (this._onBuildingClick) this._onBuildingClick(b);
          });
        }
        this.buildingLayers.set(b.id, polygon);
      }
      // 入口标记
      if (b.entrance) {
        const marker = L.marker([b.entrance.lat, b.entrance.lng], {
          title: `${b.name} 入口`
        }).addTo(this.map);
        marker.bindPopup(`<b>${b.name}</b><br>入口`);
        this.poiMarkers.set(`entrance-${b.id}`, marker);
      }
    }
  }

  /**
   * 渲染 POI（校门、餐厅等）
   * @param {Object[]} pois
   */
  renderPOIs(pois) {
    for (const p of pois) {
      const icon = L.divIcon({
        className: 'poi-icon',
        html: p.icon || '📍',
        iconSize: [20, 20]
      });
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(this.map);
      marker.bindPopup(`<b>${p.name}</b>`);
      marker.on('click', () => {
        if (this._onMapClick) this._onMapClick(p);
      });
      this.poiMarkers.set(p.id, marker);
    }
  }

  setView(lat, lng, zoom) {
    this.map.setView([lat, lng], zoom || 18);
  }

  /** 注册建筑点击回调 */
  onBuildingClick(fn) { this._onBuildingClick = fn; }
  /** 注册地图点击回调（选点用） */
  onMapClick(fn) { this._onMapClick = fn; }

  getMap() { return this.map; }
}

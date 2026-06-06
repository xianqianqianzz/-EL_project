/**
 * 室外区域图片地图。
 * 使用 Leaflet CRS.Simple，以区域 map.png 的像素坐标作为唯一坐标系。
 */
class OutdoorMap {
  constructor(containerId) {
    /** @type {L.Map} */
    this.map = L.map(containerId, {
      crs: L.CRS.Simple,
      center: [0, 0],
      zoom: -2,
      minZoom: -4,
      maxZoom: 3,
      zoomControl: true
    });

    this.areaData = null;
    this.imageLayer = null;
    this.imageBounds = null;
    this.buildingLayers = new Map();
    this.outdoorTargetMarkers = new Map();
    this.selectableNodeLayer = L.layerGroup().addTo(this.map);
    this._onBuildingClick = null;
    this._onMapClick = null;
  }

  /**
   * 加载区域唯一底图。
   * @param {Object} areaData
   * @param {string} areaPath - area.json 相对项目根目录的路径
   */
  configureArea(areaData, areaPath) {
    this.areaData = areaData;
    const width = areaData.image?.width;
    const height = areaData.image?.height;
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error(`区域 ${areaData.areaId} 缺少 image.width/image.height`);
    }

    if (this.imageLayer) this.map.removeLayer(this.imageLayer);
    // Leaflet 纬度轴向上，而图片像素 y 轴向下；使用负纬度保持底图与像素坐标同向。
    this.imageBounds = [[-height, 0], [0, width]];
    const areaDir = areaPath.replace(/[^/]+$/, '');
    const imageUrl = `${areaDir}${areaData.image.path}`;
    this.imageLayer = L.imageOverlay(imageUrl, this.imageBounds).addTo(this.map);
    this.map.setMaxBounds([[-height * 1.1, -width * 0.1], [height * 0.1, width * 1.1]]);
    this.map.fitBounds(this.imageBounds, { padding: [12, 12] });
  }

  /**
   * 根据区域 places 渲染建筑入口标记。
   * @param {Object[]} buildings
   * @param {Object[]} places
   */
  renderBuildings(buildings, places = []) {
    const placeByBuildingId = new Map(
      places.filter(place => place.buildingId).map(place => [place.buildingId, place])
    );

    for (const building of buildings) {
      const place = placeByBuildingId.get(building.id);
      if (!place || !OutdoorMap.hasPixelPoint(place)) continue;
      const marker = L.marker(OutdoorMap.toLeafletPoint(place), {
        title: `${building.name} 入口`,
        bubblingMouseEvents: false
      }).addTo(this.map);
      marker.bindPopup(`<b>${building.name}</b><br>入口`);
      marker.on('click', (event) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        if (this._onBuildingClick) this._onBuildingClick(building);
      });
      this.buildingLayers.set(building.id, marker);
      this.outdoorTargetMarkers.set(`entrance-${building.id}`, marker);
    }
  }

  /**
   * 渲染室外目标。建筑由 renderBuildings 单独处理。
   * @param {Object[]} targets
   */
  renderOutdoorTargets(targets) {
    for (const place of targets) {
      if (place.buildingId || !OutdoorMap.hasPixelPoint(place)) continue;
      const icon = L.divIcon({
        className: 'outdoor-target-icon',
        html: '点',
        iconSize: [20, 20]
      });
      const marker = L.marker(OutdoorMap.toLeafletPoint(place), {
        icon,
        title: place.label,
        bubblingMouseEvents: false
      }).addTo(this.map);
      marker.bindPopup(`<b>${place.label}</b>`);
      marker.on('click', (event) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        if (this._onMapClick) this._onMapClick(place);
      });
      this.outdoorTargetMarkers.set(place.id, marker);
    }
  }

  setView(x, y, zoom) {
    this.map.setView([-y, x], zoom ?? 0);
  }

  showSelectableNodes(items, role, onSelect) {
    this.hideSelectableNodes();
    this.map.getContainer().classList.add('map-selecting');
    for (const item of items) {
      const marker = L.circleMarker(OutdoorMap.toLeafletPoint(item), {
        radius: 6,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
        className: `selectable-route-node ${role}-node`,
        bubblingMouseEvents: false
      }).addTo(this.selectableNodeLayer);
      marker.bindTooltip(item.label, { direction: 'top', offset: [0, -6] });
      marker.on('click', (event) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        onSelect(item);
      });
    }
  }

  hideSelectableNodes() {
    this.selectableNodeLayer.clearLayers();
    this.map.getContainer().classList.remove('map-selecting');
  }

  static hasPixelPoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
  }

  static toLeafletPoint(point) {
    return [-point.y, point.x];
  }

  onBuildingClick(fn) { this._onBuildingClick = fn; }
  onMapClick(fn) { this._onMapClick = fn; }
  getMap() { return this.map; }
}

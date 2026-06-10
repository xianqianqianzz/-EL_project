/**
 * 室内地图模块
 * 使用 Leaflet CRS.Simple 展示楼层平面图，与室外地图保持一致的交互体验
 */
class IndoorMap {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.imageLayer = null;
    this.annotationLayer = null;
    this.building = null;
    this.currentFloorIdx = 0;
    this._onBack = null;
  }

  loadBuilding(building) {
    if (!building || !building.floors || !building.floors.length) return;
    this.building = building;
    this.currentFloorIdx = 0;
    this._initMap();
    this._showCurrentFloor();
  }

  switchFloor(floorIdx) {
    if (!this.building) return;
    this.currentFloorIdx = Math.max(0, Math.min(floorIdx, this.building.floors.length - 1));
    this._showCurrentFloor();
  }

  getCurrentFloor() {
    if (!this.building) return null;
    return this.building.floors[this.currentFloorIdx];
  }

  getFloorCount() {
    return this.building ? this.building.floors.length : 0;
  }

  _initMap() {
    var container = document.getElementById(this.containerId);
    if (!container) return;
    if (this.map) { this.map.remove(); this.map = null; }
    this.map = L.map(this.containerId, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      zoomSnap: 0.25,
      attributionControl: false,
      zoomControl: false
    });
    this.annotationLayer = L.layerGroup().addTo(this.map);
  }

  _showCurrentFloor() {
    if (!this.map || !this.building) return;
    var floor = this.building.floors[this.currentFloorIdx];
    if (!floor || !floor.image) return;
    if (this.imageLayer) this.map.removeLayer(this.imageLayer);
    this.annotationLayer.clearLayers();
    var self = this;
    var img = new Image();
    img.onload = function() {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      var bounds = [[-h, 0], [0, w]];
      self.imageLayer = L.imageOverlay(floor.image, bounds).addTo(self.map);
      self.map.fitBounds(bounds, { padding: [20, 20] });
      self.map.setMaxBounds(bounds);
      if (floor.description) {
        self._renderDescriptionMarker(floor.description, w, h);
      }
    };
    img.src = floor.image;
  }

  _renderDescriptionMarker(desc, imgW, imgH) {
    var raw = typeof desc === 'string' ? desc : (desc.text || '');
    if (!raw.trim()) return;
    var lines = raw.split('\n').filter(function(l) { return l.trim(); });
    var title = lines[0] || '楼层说明';
    var marker = L.marker([-10, 10], {
      icon: L.divIcon({
        className: 'indoor-info-marker',
        html: '<span class="indoor-info-icon">&#9432;</span>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(this.annotationLayer);
    var parts = [];
    for (var i = 0; i < Math.min(lines.length, 30); i++) {
      parts.push('<p style="margin:2px 0">' + lines[i] + '</p>');
    }
    var popupContent = '<div style="max-width:300px;max-height:220px;overflow-y:auto;font-size:12px;line-height:1.6">' + parts.join('') + '</div>';
    marker.bindPopup(popupContent);
  }

  destroy() {
    if (this.map) { this.map.remove(); this.map = null; }
    this.imageLayer = null;
    this.building = null;
  }

  onBack(fn) { this._onBack = fn; }
}

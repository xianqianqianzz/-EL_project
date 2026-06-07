class PathRenderer {
  constructor() {
    this.outdoorLine = null;
    this.markers = [];
  }

  drawOutdoor(map, pathNodes) {
    this.clearOutdoor(map);
    const points = pathNodes.filter(node => (node.floor ?? 0) === 0).map(PathRenderer.nodeToLeafletPoint);
    if (points.length < 2) return;

    this.outdoorLine = L.polyline(points, {
      color: '#315f8c',
      weight: 6,
      opacity: .9
    }).addTo(map);

    const startIcon = L.divIcon({ className: 'marker-start', iconSize: [24, 24] });
    const endIcon = L.divIcon({ className: 'marker-end', iconSize: [24, 24] });
    this.markers.push(L.marker(points[0], { icon: startIcon }).addTo(map));
    this.markers.push(L.marker(points[points.length - 1], { icon: endIcon }).addTo(map));
    map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 0 });
  }

  clearOutdoor(map) {
    if (this.outdoorLine) map.removeLayer(this.outdoorLine);
    for (const marker of this.markers) map.removeLayer(marker);
    this.outdoorLine = null;
    this.markers = [];
  }

  static nodeToLeafletPoint(node) {
    if ([node?.x, node?.y].every(Number.isFinite)) return [-node.y, node.x];
    return [node.lat, node.lng];
  }

  static segmentPath(pathNodes) {
    const segments = [];
    let current = null;
    for (const node of pathNodes) {
      const type = (node.floor ?? 0) === 0 ? 'outdoor' : 'indoor';
      if (!current || current.type !== type || (type === 'indoor' && current.floor !== node.floor)) {
        current = { type, floor: node.floor ?? 0, nodes: [] };
        segments.push(current);
      }
      current.nodes.push(node);
    }
    return segments;
  }
}

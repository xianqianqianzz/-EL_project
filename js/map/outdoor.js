class OutdoorMap {
  constructor(containerId, area, imagePath) {
    this.area = area;
    this.bounds = [[-area.image.height, 0], [0, area.image.width]];
    this.map = L.map(containerId, {
      crs: L.CRS.Simple,
      minZoom: -4,
      maxZoom: 2,
      zoomSnap: 0.25,
      attributionControl: false
    });

    L.imageOverlay(imagePath, this.bounds).addTo(this.map);
    this.map.fitBounds(this.bounds, { padding: [12, 12] });
    this.map.setMaxBounds(this.bounds);

    this.placeLayer = L.layerGroup().addTo(this.map);
    this.selectableNodeLayer = L.layerGroup().addTo(this.map);
    this._onPlaceClick = null;
  }

  point(x, y) {
    return L.latLng(-y, x);
  }

  renderPlaces(places) {
    this.placeLayer.clearLayers();
    for (const place of places) {
      const marker = L.marker(this.point(place.x, place.y), {
        icon: L.divIcon({ className: 'place-marker', iconSize: [18, 18] }),
        title: place.label
      }).addTo(this.placeLayer);
      marker.bindTooltip(place.label, {
        permanent: false,
        direction: 'right',
        offset: [8, 0],
        className: 'place-tooltip'
      });
      marker.bindPopup(`<strong>${OutdoorMap.escapeHtml(place.label)}</strong>`);
      marker.on('click', event => {
        L.DomEvent.stopPropagation(event);
        const handled = this._onPlaceClick?.(place);
        if (!handled) {
          marker.openPopup();
        }
      });
    }
  }

  showSelectableNodes(items, role, onSelect) {
    this.hideSelectableNodes();
    this.map.getContainer().classList.add('map-selecting');
    for (const item of items) {
      const marker = L.circleMarker(this.point(item.x, item.y), {
        radius: 7,
        weight: 3,
        opacity: 1,
        fillOpacity: .86,
        className: `selectable-route-node ${role}-node`
      }).addTo(this.selectableNodeLayer);
      marker.bindTooltip(item.label, { direction: 'top', offset: [0, -6] });
      marker.on('click', event => {
        L.DomEvent.stopPropagation(event);
        onSelect(item);
      });
    }
  }

  hideSelectableNodes() {
    this.selectableNodeLayer.clearLayers();
    this.map.getContainer().classList.remove('map-selecting');
  }

  onPlaceClick(fn) {
    this._onPlaceClick = fn;
  }

  static escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[character]);
  }
}

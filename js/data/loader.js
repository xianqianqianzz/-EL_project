class DataLoader {
  static async loadJSON(path) {
    const separator = path.includes('?') ? '&' : '?';
    const requestPath = `${path}${separator}dataVersion=${Date.now()}`;
    const resp = await fetch(requestPath, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`加载 ${path} 失败：${resp.status}`);
    return resp.json();
  }

  static async loadAll(paths) {
    return Promise.all(paths.map(p => DataLoader.loadJSON(p)));
  }

  static async loadIndoor(buildingId, areaIndex) {
    const entry = (areaIndex?.areas || []).find(area =>
      area.type === 'indoor' && area.buildingId === buildingId
    );
    if (!entry) throw new Error(`未登记建筑 ${buildingId} 的室内区域`);
    return DataLoader.loadJSON(entry.path);
  }

  static normalizeOutdoorArea(area) {
    const scale = area.image?.metersPerPixel || 1;
    return {
      ...area,
      places: (area.places || []).map(place => ({ ...place, floor: 0 })),
      nodes: (area.nodes || []).map(node => ({
        ...node,
        floor: 0,
        metersPerPixel: scale
      })),
      edges: area.edges || []
    };
  }
}

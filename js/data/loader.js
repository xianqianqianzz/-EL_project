/**
 * 数据加载器
 * 负责加载 JSON 数据文件
 */
class DataLoader {
  /**
   * @param {string} path - JSON 文件路径
   * @returns {Promise<Object>}
   */
  static async loadJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`加载 ${path} 失败: ${resp.status}`);
    return resp.json();
  }

  /**
   * 批量加载
   * @param {string[]} paths
   * @returns {Promise<Object[]>}
   */
  static async loadAll(paths) {
    return Promise.all(paths.map(p => DataLoader.loadJSON(p)));
  }

  /**
   * 加载室内建筑数据
   * @param {string} buildingId
   * @returns {Promise<Object>}
   */
  static async loadIndoor(buildingId, areaIndex) {
    const entry = (areaIndex?.areas || []).find(area =>
      area.buildingId === buildingId && area.type === 'indoor'
    );
    if (!entry?.path) throw new Error(`区域索引中不存在建筑 ${buildingId} 的室内 area.json`);
    return DataLoader.loadJSON(entry.path);
  }

  /**
   * 将区域文件夹模型转换为当前室外运行时数据。
   * @param {Object} areaData - data/areas/<area-id>/area.json
   */
  static normalizeOutdoorArea(areaData) {
    const nodes = areaData.nodes || [];
    const edges = areaData.edges || [];
    return {
      outdoorTargets: areaData.places || [],
      outdoorNodes: {
        description: areaData.name || areaData.areaId,
        nodes,
        edges: edges.map(edge => ({
          from: edge.from,
          to: edge.to,
          weight: edge.weight
        }))
      },
      outdoorPaths: {
        version: areaData.version || 1,
        coordinateSystem: areaData.coordinateSystem,
        metersPerPixel: areaData.image?.metersPerPixel ?? 1,
        source: areaData.source,
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type,
          x: node.x,
          y: node.y
        })),
        edges
      }
    };
  }
}

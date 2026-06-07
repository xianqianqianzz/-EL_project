/**
 * 室内走廊图构建器
 * 从 area.json 格式的室内数据加载室内节点与边
 * 室内区域也遵守"一张图片 + 一个 area.json"规范
 */
class IndoorGraphBuilder {
  /**
   * @param {Graph} graph - 统一图实例
   */
  constructor(graph) {
    this.graph = graph;
    /** @type {Map<string, string[]>} buildingId -> indoorNodeIds */
    this.buildingNodes = new Map();
  }

  /**
   * @param {string} buildingId
   * @param {Object} indoorData - 符合 area.json v2 规范的室内数据
   *   { nodes: [...], edges: [...], links: [...], floor: N }
   */
  build(buildingId, indoorData) {
    const ids = [];
    const floor = indoorData.floor ?? 0;
    for (const n of (indoorData.nodes || [])) {
      this.graph.addNode({
        ...n,
        floor: floor,
        building: buildingId,
        metersPerPixel: n.metersPerPixel ?? indoorData.image?.metersPerPixel ?? 1
      });
      ids.push(n.id);
    }
    for (const e of (indoorData.edges || [])) {
      if (e.walkable === false) continue;
      this.graph.addEdge(e.from, e.to, e.weight);
    }
    this.buildingNodes.set(buildingId, ids);

    // 通过 links 连接室内入口到室外节点
    if (indoorData.links) {
      for (const link of indoorData.links) {
        if (this.graph.getNode(link.from) && this.graph.getNode(link.to)) {
          this.graph.addEdge(link.from, link.to, link.weight ?? 0.5);
        }
      }
    }
    return ids;
  }

  /**
   * 获取指定建筑某楼层的所有室内节点
   */
  getFloorNodes(buildingId, floor) {
    const ids = this.buildingNodes.get(buildingId) || [];
    return ids
      .map(id => this.graph.getNode(id))
      .filter(n => n && (n.floor ?? 0) === floor);
  }

  /**
   * 获取指定建筑的最高/最低楼层
   */
  getFloorRange(buildingId) {
    const ids = this.buildingNodes.get(buildingId) || [];
    const floors = ids.map(id => this.graph.getNode(id)?.floor)
                      .filter(f => f !== undefined && f !== null);
    return { min: Math.min(...floors), max: Math.max(...floors) };
  }
}

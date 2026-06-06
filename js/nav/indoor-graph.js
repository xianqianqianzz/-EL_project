/**
 * 室内走廊图构建器
 * 从区域索引注册的室内 area.json 加载节点与边
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
   * @param {Object} indoorData - 来自 indoor/*.json
   *   { nodes: [...], edges: [...], floors: [...] }
   * @param {string} [outdoorEntranceId] - area.json 中建筑地点的 routeNodeId
   */
  build(buildingId, indoorData, outdoorEntranceId) {
    const ids = [];
    for (const n of (indoorData.nodes || [])) {
      this.graph.addNode({ ...n, building: buildingId });
      ids.push(n.id);
    }
    for (const id of ids) {
      this.graph.connectNodeConnections(id);
    }
    for (const e of (indoorData.edges || [])) {
      this.graph.addEdge(e.from, e.to, e.weight);
    }
    this.buildingNodes.set(buildingId, ids);

    // 连接室内入口到室外入口
    if (indoorData.entranceLink) {
      const indoorEntranceId = indoorData.entranceLink;
      if (this.graph.getNode(outdoorEntranceId) && this.graph.getNode(indoorEntranceId)) {
        // 入口边权重为0或极小（视为同一位置）
        this.graph.addEdge(outdoorEntranceId, indoorEntranceId, 0.5);
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
      .filter(n => n && n.floor === floor);
  }

  /**
   * 获取指定建筑的最高/最低楼层
   */
  getFloorRange(buildingId) {
    const ids = this.buildingNodes.get(buildingId) || [];
    const floors = ids.map(id => this.graph.getNode(id)?.floor)
                      .filter(f => f !== undefined);
    return { min: Math.min(...floors), max: Math.max(...floors) };
  }
}

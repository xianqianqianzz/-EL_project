/**
 * 室外路网图构建器
 * 从室外区域数据加载节点和边。边权由相邻节点的像素距离计算。
 */
class OutdoorGraphBuilder {
  /**
   * @param {Graph} graph - 统一图实例
   */
  constructor(graph) {
    this.graph = graph;
  }

  /**
   * @param {Object[]} nodes - 室外区域 nodes 数组
   * @param {Object[]} edges - 室外区域 edges 数组
   * @param {Object} [pathNetwork] - 标准化后的区域节点与边
   * @returns {string[]} 添加的节点ID列表
   */
  build(nodes, edges, pathNetwork) {
    const ids = [];
    const metersPerPixel = pathNetwork?.metersPerPixel;
    for (const n of nodes) {
      this.graph.addNode({ ...n, metersPerPixel, floor: 0, building: null });
      ids.push(n.id);
    }
    for (const n of (pathNetwork?.nodes || [])) {
      if (this.graph.getNode(n.id)) continue;
      this.graph.addNode({
        ...n,
        metersPerPixel,
        connections: n.connections || [],
        floor: 0,
        building: null
      });
      ids.push(n.id);
    }
    this.graph.connectAllConnections();
    const graphEdges = pathNetwork?.edges?.length ? pathNetwork.edges : (edges || []);
    const seen = new Set();
    for (const e of graphEdges) {
      if (e.walkable === false) continue;
      const key = [e.from, e.to].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);
      this.graph.addEdge(e.from, e.to, e.weight);
    }
    return ids;
  }

}

/**
 * 室外路网图构建器
 * 从 outdoor-nodes.json 加载道路节点，并用 outdoor-paths.json 补充真实步行折线与边权。
 */
class OutdoorGraphBuilder {
  /**
   * @param {Graph} graph - 统一图实例
   */
  constructor(graph) {
    this.graph = graph;
  }

  /**
   * @param {Object[]} nodes - 来自 outdoor-nodes.json 的 nodes 数组
   * @param {Object[]} edges - 来自 outdoor-nodes.json 的 edges 数组
   * @param {Object} [pathNetwork] - 来自 outdoor-paths.json 的真实路径折线网络
   * @returns {string[]} 添加的节点ID列表
   */
  build(nodes, edges, pathNetwork) {
    const ids = [];
    for (const n of nodes) {
      this.graph.addNode({ ...n, floor: 0, building: null });
      ids.push(n.id);
    }
    for (const n of (pathNetwork?.nodes || [])) {
      if (this.graph.getNode(n.id)) continue;
      this.graph.addNode({
        ...n,
        connections: n.connections || [],
        floor: 0,
        building: null
      });
      ids.push(n.id);
    }
    this.graph.connectAllConnections();
    for (const e of (edges || [])) {
      this.graph.addEdge(e.from, e.to, e.weight);
    }
    for (const e of (pathNetwork?.edges || [])) {
      if (e.walkable === false) continue;
      this.graph.addEdge(e.from, e.to, e.weight ?? OutdoorGraphBuilder.pathDistanceMeters(e.path));
    }
    return ids;
  }

  /**
   * 将建筑入口注册为室外图中的节点
   * @param {Object} building - 来自 buildings.json 的建筑对象
   */
  registerBuildingEntrance(building) {
    if (!building.entrance) return;
    const node = {
      id: `entrance-${building.id}`,
      type: 'entrance',
      lat: building.entrance.lat,
      lng: building.entrance.lng,
      floor: 0,
      building: building.id,
      label: `${building.name} 入口`,
      connections: building.entrance.connectsTo || []
    };
    this.graph.addNode(node);

    // 连接到最近的室外道路节点
    if (building.entrance.nearestRoadNode) {
      this.graph.addEdge(node.id, building.entrance.nearestRoadNode);
    }
    return node;
  }

  static pathDistanceMeters(path) {
    if (!Array.isArray(path) || path.length < 2) return undefined;
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      const [lat1, lng1] = path[i - 1] || [];
      const [lat2, lng2] = path[i] || [];
      if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return undefined;
      distance += Graph.haversine(lat1, lng1, lat2, lng2) * 1000;
    }
    return distance;
  }
}

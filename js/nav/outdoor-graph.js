/**
 * 室外路网图构建器
 * 从 outdoor-nodes.json 加载道路节点与边，构建室外 Graph
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
   * @returns {string[]} 添加的节点ID列表
   */
  build(nodes, edges) {
    const ids = [];
    for (const n of nodes) {
      this.graph.addNode({ ...n, floor: 0, building: null });
      ids.push(n.id);
    }
    for (const e of edges) {
      this.graph.addEdge(e.from, e.to, e.weight);
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
}

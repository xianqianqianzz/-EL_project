/**
 * 图数据结构
 * 用于存储路径规划的节点和边，支持室外+室内混合图
 */
class Graph {
  constructor() {
    /** @type {Map<string, GraphNode>} */
    this.nodes = new Map();
    /** @type {Map<string, Map<string, number>>} adjacency: nodeId -> { neighborId: weight } */
    this.adjacency = new Map();
  }

  /**
   * @param {GraphNode} node
   */
  addNode(node) {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Map());
    }
    this.connectNodeConnections(node.id);
  }

  /**
   * 根据节点自身的 connections 建边。目标节点尚未加载时先跳过，
   * 等批量加载完成后由 connectAllConnections() 补齐。
   * @param {string} nodeId
   */
  connectNodeConnections(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node || !node.connections) return;
    for (const targetId of node.connections) {
      if (this.nodes.has(targetId)) {
        this.addEdge(node.id, targetId);
      }
    }
  }

  /**
   * 批量补齐所有 nodes[].connections 推导出的边。
   */
  connectAllConnections() {
    for (const nodeId of this.nodes.keys()) {
      this.connectNodeConnections(nodeId);
    }
  }

  /**
   * @param {string} fromId
   * @param {string} toId
   * @param {number} [weight] - 不传则自动按坐标计算距离
   */
  addEdge(fromId, toId, weight) {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);
    if (!fromNode || !toNode) {
      console.warn(`[Graph] 跳过不存在节点的边: ${fromId} <-> ${toId}`);
      return false;
    }

    if (!this.adjacency.has(fromId)) this.adjacency.set(fromId, new Map());
    if (!this.adjacency.has(toId)) this.adjacency.set(toId, new Map());

    if (weight === undefined) {
      weight = Graph.distanceMeters(fromNode, toNode);
      if (fromNode.floor !== toNode.floor) {
        weight += Math.abs(fromNode.floor - toNode.floor) * 5;
      }
    }
    this.adjacency.get(fromId).set(toId, weight);
    this.adjacency.get(toId).set(fromId, weight); // 无向图
    return true;
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getNeighbors(id) {
    return this.adjacency.get(id) || new Map();
  }

  /**
   * Haversine 公式计算两点间的直线距离（千米）
   */
  static haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) *
              Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  static distanceMeters(a, b) {
    if ([a?.x, a?.y, b?.x, b?.y].every(Number.isFinite)) {
      const scale = a.metersPerPixel ?? b.metersPerPixel ?? 1;
      return Math.hypot(a.x - b.x, a.y - b.y) * scale;
    }
    if ([a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) {
      return Graph.haversine(a.lat, a.lng, b.lat, b.lng) * 1000;
    }
    return 0;
  }

  size() {
    return this.nodes.size;
  }
}

/**
 * @typedef {Object} GraphNode
 * @property {string} id       - 唯一标识
 * @property {string} type     - corridor|room|facility|stair|elevator|entrance|road|path|target
 * @property {number} lat      - 纬度
 * @property {number} lng      - 经度
 * @property {number} floor    - 楼层（室外为 0）
 * @property {string} [building] - 所属建筑ID（室外为 null）
 * @property {string} label    - 显示名称
 * @property {string[]} [connections] - 邻接节点ID（可选，也可通过 addEdge 添加）
 */

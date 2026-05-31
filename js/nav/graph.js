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
    // 自动建立与 connections 列表中节点的边
    if (node.connections) {
      for (const targetId of node.connections) {
        this.addEdge(node.id, targetId);
      }
    }
  }

  /**
   * @param {string} fromId
   * @param {string} toId
   * @param {number} [weight] - 不传则自动按坐标计算距离
   */
  addEdge(fromId, toId, weight) {
    if (!this.adjacency.has(fromId)) this.adjacency.set(fromId, new Map());
    if (!this.adjacency.has(toId)) this.adjacency.set(toId, new Map());

    if (weight === undefined) {
      const fromNode = this.nodes.get(fromId);
      const toNode = this.nodes.get(toId);
      if (fromNode && toNode) {
        weight = Graph.haversine(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng) * 1000; // 米
        // 跨楼层增加垂直开销
        if (fromNode.floor !== toNode.floor) {
          weight += Math.abs(fromNode.floor - toNode.floor) * 5; // 每层楼高约5米等效距离
        }
      } else {
        weight = 1;
      }
    }
    this.adjacency.get(fromId).set(toId, weight);
    this.adjacency.get(toId).set(fromId, weight); // 无向图
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

  size() {
    return this.nodes.size;
  }
}

/**
 * @typedef {Object} GraphNode
 * @property {string} id       - 唯一标识
 * @property {string} type     - corridor|room|stair|elevator|entrance|road|path|poi
 * @property {number} lat      - 纬度
 * @property {number} lng      - 经度
 * @property {number} floor    - 楼层（室外为 0）
 * @property {string} [building] - 所属建筑ID（室外为 null）
 * @property {string} label    - 显示名称
 * @property {string[]} [connections] - 邻接节点ID（可选，也可通过 addEdge 添加）
 */

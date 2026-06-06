/**
 * A* 路径规划算法
 * 在统一图上查找最短路径，支持启发式搜索
 */
class AStar {
  /**
   * @param {Graph} graph
   * @param {string} startId
   * @param {string} goalId
   * @returns {{ path: GraphNode[], distance: number } | null}
   */
  static findPath(graph, startId, goalId) {
    const start = graph.getNode(startId);
    const goal = graph.getNode(goalId);
    if (!start || !goal) return null;

    // openSet: 待探索节点（用 Map 支持快速查找和更新）
    const openSet = new Map();  // nodeId -> fScore
    openSet.set(startId, 0);

    const cameFrom = new Map();  // nodeId -> nodeId
    const gScore = new Map();    // nodeId -> 实际距离
    gScore.set(startId, 0);

    const fScore = new Map();    // nodeId -> 估算总距离
    fScore.set(startId, AStar.heuristic(start, goal));

    let iterations = 0;
    const maxIterations = 10000;

    while (openSet.size > 0 && iterations < maxIterations) {
      iterations++;

      // 取 fScore 最小的节点
      let currentId = null;
      let minF = Infinity;
      for (const [id] of openSet) {
        const f = fScore.has(id) ? fScore.get(id) : Infinity;
        if (f < minF) { minF = f; currentId = id; }
      }
      if (currentId === null) break;

      if (currentId === goalId) {
        return {
          path: AStar.reconstructPath(cameFrom, currentId, graph),
          distance: gScore.get(goalId) ?? 0
        };
      }

      openSet.delete(currentId);

      for (const [neighborId, weight] of graph.getNeighbors(currentId)) {
        const currentG = gScore.has(currentId) ? gScore.get(currentId) : Infinity;
        const tentativeG = currentG + weight;
        const previousG = gScore.has(neighborId) ? gScore.get(neighborId) : Infinity;

        if (tentativeG < previousG) {
          cameFrom.set(neighborId, currentId);
          gScore.set(neighborId, tentativeG);

          const neighbor = graph.getNode(neighborId);
          if (!neighbor) continue;
          const h = AStar.heuristic(neighbor, goal);
          fScore.set(neighborId, tentativeG + h);

          if (!openSet.has(neighborId)) {
            openSet.set(neighborId, tentativeG + h);
          }
        }
      }
    }

    return null; // 无路径
  }

  /**
   * 启发函数：按节点坐标系计算直线距离，并加上楼层差。
   */
  static heuristic(node, goal) {
    let h = Graph.distanceMeters(node, goal);
    // 楼层差异惩罚
    if (node.floor !== goal.floor) {
      h += Math.abs(node.floor - goal.floor) * 5;
    }
    return h;
  }

  static reconstructPath(cameFrom, currentId, graph) {
    const path = [];
    let id = currentId;
    while (id) {
      path.unshift(graph.getNode(id));
      id = cameFrom.get(id);
    }
    return path;
  }
}

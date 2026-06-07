class OutdoorGraphBuilder {
  constructor(graph) {
    this.graph = graph;
  }

  build(nodes, edges, metersPerPixel = 1) {
    const ids = [];
    for (const n of nodes) {
      this.graph.addNode({
        ...n,
        floor: 0,
        building: null,
        metersPerPixel: n.metersPerPixel ?? metersPerPixel
      });
      ids.push(n.id);
    }
    for (const e of (edges || [])) {
      if (e.walkable === false) continue;
      this.graph.addEdge(e.from, e.to, e.weight);
    }
    return ids;
  }
}

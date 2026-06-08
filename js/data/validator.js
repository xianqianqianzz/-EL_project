class DataValidator {
  static validateArea(area) {
    const problems = [];
    if (area?.version !== 2) problems.push('version 必须为 2');
    if (area?.coordinateSystem !== 'image-pixel') problems.push('coordinateSystem 必须为 image-pixel');
    if (!Number.isFinite(area?.image?.width) || !Number.isFinite(area?.image?.height)) {
      problems.push('image.width/image.height 必须是数字');
    }

    const nodeIds = new Set();
    for (const node of (area?.nodes || [])) {
      if (!node.id || nodeIds.has(node.id)) problems.push(`节点 ID 缺失或重复：${node.id || '?'}`);
      nodeIds.add(node.id);
      if (node.type !== 'node') problems.push(`${node.id}.type 必须为 node`);
      if (![node.x, node.y].every(Number.isFinite)) problems.push(`${node.id} 缺少有效 x/y`);
    }
    for (const edge of (area?.edges || [])) {
      if (edge.type !== 'edge') problems.push(`${edge.id}.type 必须为 edge`);
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) problems.push(`${edge.id} 引用了不存在的节点`);
    }
    for (const place of (area?.places || [])) {
      if (place.type !== 'place') problems.push(`${place.id}.type 必须为 place`);
      if (!place.label || !nodeIds.has(place.routeNodeId)) problems.push(`${place.id} 缺少 label 或有效 routeNodeId`);
    }
    return problems;
  }
}

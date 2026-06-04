/**
 * 数据格式校验
 * 检查加载的 JSON 是否符合预期 schema
 */
class DataValidator {
  static validateGraphNode(node, index) {
    const required = ['id', 'type', 'lat', 'lng', 'label'];
    const missing = required.filter(f => node[f] === undefined);
    if (missing.length) {
      console.warn(`节点 #${index} (${node.id || '?'}) 缺少字段: ${missing.join(', ')}`);
      return false;
    }
    if (typeof node.lat !== 'number' || typeof node.lng !== 'number') {
      console.warn(`节点 ${node.id} 坐标无效`);
      return false;
    }
    return true;
  }

  static validateEdge(edge, index) {
    if (!edge.from || !edge.to) {
      console.warn(`边 #${index} 缺少 from/to`);
      return false;
    }
    return true;
  }

  static reportOutdoorPathNetwork(pathNetwork) {
    const nodes = pathNetwork?.nodes || [];
    const edges = pathNetwork?.edges || [];
    const nodeIds = new Set(nodes.map(n => n.id));
    const allowedStatus = new Set(['draft', 'reviewed', 'needs-review']);
    const allowedTypes = new Set(['walkway', 'road', 'crossing', 'stair', 'ramp', 'bridge', 'entrance-link']);
    const problems = [];
    const statusCount = { draft: 0, reviewed: 0, 'needs-review': 0 };

    DataValidator.reportUniqueIds('室外路径节点', nodes);
    DataValidator.reportUniqueIds('室外路径边', edges);

    for (const edge of edges) {
      if (!nodeIds.has(edge.from)) problems.push(`${edge.id || '?'} 缺少 from 节点 ${edge.from}`);
      if (!nodeIds.has(edge.to)) problems.push(`${edge.id || '?'} 缺少 to 节点 ${edge.to}`);
      if (!allowedTypes.has(edge.type)) problems.push(`${edge.id || '?'} 类型不建议使用: ${edge.type}`);
      if (!allowedStatus.has(edge.reviewStatus)) {
        problems.push(`${edge.id || '?'} reviewStatus 无效: ${edge.reviewStatus}`);
      } else {
        statusCount[edge.reviewStatus]++;
      }
      if (!Array.isArray(edge.path) || edge.path.length < 2) {
        problems.push(`${edge.id || '?'} path 至少需要两个点`);
        continue;
      }
      for (const point of edge.path) {
        if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
          problems.push(`${edge.id || '?'} path 点格式应为 [lat, lng]`);
          break;
        }
      }
    }

    console.log(
      `[校验] 室外路径折线: ${edges.length} 条边，` +
      `${statusCount.reviewed} reviewed, ${statusCount.draft} draft, ` +
      `${statusCount['needs-review']} needs-review`
    );
    if (problems.length) {
      console.warn(`[校验] 室外路径折线存在 ${problems.length} 个问题`);
      console.warn(`  示例: ${problems.slice(0, 8).join('; ')}`);
    }
    return { problems, statusCount };
  }

  static validateBuilding(building, index) {
    if (!building.id || !building.name) {
      console.warn(`建筑 #${index} 缺少 id/name`);
      return false;
    }
    if (building.entrance && !building.entrance.nearestRoadNode) {
      console.warn(`建筑 ${building.id} 入口缺少 nearestRoadNode`);
      return false;
    }
    return true;
  }

  static reportUniqueIds(name, items) {
    const seen = new Set();
    const duplicates = [];
    for (const item of items) {
      if (!item?.id) continue;
      if (seen.has(item.id)) duplicates.push(item.id);
      seen.add(item.id);
    }
    if (duplicates.length) {
      console.warn(`[校验] ${name}: 重复 ID ${duplicates.join(', ')}`);
    } else {
      console.log(`[校验] ${name}: ID 无重复`);
    }
    return duplicates;
  }

  static reportConnections(name, nodes) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const missing = [];
    const oneWay = [];

    for (const node of nodes) {
      for (const targetId of (node.connections || [])) {
        const target = byId.get(targetId);
        if (!target) {
          missing.push(`${node.id}->${targetId}`);
          continue;
        }
        if (!(target.connections || []).includes(node.id)) {
          oneWay.push(`${node.id}->${targetId}`);
        }
      }
    }

    const parts = [
      `缺失引用 ${missing.length}`,
      `单向连接 ${oneWay.length}`
    ];
    console.log(`[校验] ${name}: ${parts.join(', ')}`);
    if (missing.length) console.warn(`  缺失引用示例: ${missing.slice(0, 8).join('; ')}`);
    if (oneWay.length) console.warn(`  单向连接示例: ${oneWay.slice(0, 8).join('; ')}`);
    return { missing, oneWay };
  }

  static reportRouteTargets(name, items, graph) {
    const missing = [];
    for (const item of items) {
      const routeNodeId = item.routeNodeId || item.id;
      if (!graph.getNode(routeNodeId)) {
        missing.push(`${item.id}->${routeNodeId}`);
      }
    }
    if (missing.length) {
      console.warn(`[校验] ${name}: ${missing.length} 个条目没有可寻路节点`);
      console.warn(`  示例: ${missing.slice(0, 8).join('; ')}`);
    } else {
      console.log(`[校验] ${name}: 全部可映射到 Graph 节点`);
    }
    return missing;
  }

  static reportIndoorData(buildingId, indoorData) {
    const nodes = indoorData.nodes || [];
    const floors = indoorData.floors || [];
    const levels = floors
      .map(f => typeof f === 'number' ? f : f.level)
      .filter(f => typeof f === 'number');
    const entranceOk = !indoorData.entranceLink ||
      nodes.some(n => n.id === indoorData.entranceLink);

    DataValidator.reportUniqueIds(`室内节点 ${buildingId}`, nodes);
    DataValidator.reportConnections(`室内连接 ${buildingId}`, nodes);
    if (!levels.length) {
      console.warn(`[校验] 室内楼层 ${buildingId}: floors 为空或缺少 level`);
    }
    if (!entranceOk) {
      console.warn(`[校验] 室内入口 ${buildingId}: entranceLink 不存在`);
    }
    return { levels, entranceOk };
  }

  /**
   * 批量校验并输出报告
   */
  static report(name, items, validatorFn) {
    let ok = 0, fail = 0;
    for (let i = 0; i < items.length; i++) {
      validatorFn(items[i], i) ? ok++ : fail++;
    }
    console.log(`[校验] ${name}: ${ok} 通过, ${fail} 失败 (共 ${items.length})`);
    return { ok, fail, total: items.length };
  }
}

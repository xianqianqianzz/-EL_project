const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const fatal = [];
const warnings = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function loadScript(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInThisContext(code, { filename: relativePath });
}

function report(message) {
  console.log(message);
}

function warn(message) {
  warnings.push(message);
  console.warn(message);
}

function fail(message) {
  fatal.push(message);
  console.error(message);
}

function checkUniqueIds(name, items) {
  const seen = new Set();
  const duplicates = [];
  for (const item of items) {
    if (!item.id) {
      fail(`[${name}] 缺少 id: ${JSON.stringify(item)}`);
      continue;
    }
    if (seen.has(item.id)) duplicates.push(item.id);
    seen.add(item.id);
  }
  if (duplicates.length) fail(`[${name}] 重复 id: ${duplicates.join(', ')}`);
  else report(`[${name}] ID 无重复`);
  return seen;
}

function checkConnections(name, nodes) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  let missing = 0;
  let oneWay = 0;
  for (const node of nodes) {
    for (const targetId of (node.connections || [])) {
      const target = byId.get(targetId);
      if (!target) {
        missing++;
        fail(`[${name}] 缺失连接引用: ${node.id}->${targetId}`);
        continue;
      }
      if (!(target.connections || []).includes(node.id)) {
        oneWay++;
      }
    }
  }
  if (oneWay) warn(`[${name}] 存在 ${oneWay} 条单向 connections；Graph 可运行，但建议数据同学补成双向`);
  if (!missing) report(`[${name}] connections 引用均存在`);
}

function edgeKey(a, b) {
  return [a, b].sort().join('::');
}

function normalizeOutdoorArea(areaData) {
  const nodes = areaData.nodes || [];
  const edges = areaData.edges || [];
  return {
    outdoorTargets: areaData.places || [],
    outdoorNodes: {
      description: areaData.name || areaData.areaId,
      nodes,
      edges: edges.map(edge => ({
        from: edge.from,
        to: edge.to,
        weight: edge.weight
      }))
    },
    outdoorPaths: {
      version: areaData.version || 1,
      coordinateSystem: areaData.coordinateSystem,
      metersPerPixel: areaData.image?.metersPerPixel ?? 1,
      source: areaData.source,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y
      })),
      edges
    }
  };
}

function checkAreaIndex(areaIndex) {
  if (areaIndex.version !== 1) fail('[data/areas/index.json] version 必须为 1');
  const areas = areaIndex.areas || [];
  const ids = checkUniqueIds('data/areas/index.json areas', areas);
  if (!areaIndex.defaultOutdoorAreaId) {
    fail('[data/areas/index.json] 缺少 defaultOutdoorAreaId');
  } else if (!ids.has(areaIndex.defaultOutdoorAreaId)) {
    fail(`[data/areas/index.json] defaultOutdoorAreaId 不存在: ${areaIndex.defaultOutdoorAreaId}`);
  }
  for (const area of areas) {
    if (!area.path) fail(`[data/areas/index.json] 区域 ${area.id} 缺少 path`);
  }
}

function checkAreaData(areaData, relativeDir) {
  const label = `data/areas/${areaData.areaId || '?'}/area.json`;
  if (![1, 2].includes(areaData.version)) fail(`[${label}] version 必须为 1 或 2`);
  if (!areaData.areaId) fail(`[${label}] 缺少 areaId`);
  if (!['outdoor', 'indoor'].includes(areaData.layer)) {
    fail(`[${label}] layer 必须为 outdoor 或 indoor`);
  }
  if ('type' in areaData) fail(`[${label}] 区域层级请使用 layer，不要使用根级 type`);
  if (areaData.source && 'type' in areaData.source) {
    fail(`[${label}] source.type 应移除，来源说明请写入 source.label`);
  }
  if (areaData.coordinateSystem !== 'image-pixel') {
    fail(`[${label}] coordinateSystem 必须为 image-pixel`);
  }
  if (!areaData.image?.path) {
    fail(`[${label}] 缺少 image.path`);
  } else {
    const imagePath = path.join(root, relativeDir, areaData.image.path);
    if (!fs.existsSync(imagePath)) fail(`[${label}] image.path 指向的图片不存在: ${areaData.image.path}`);
  }
  if (!Number.isFinite(areaData.image?.width) || !Number.isFinite(areaData.image?.height)) {
    fail(`[${label}] 缺少有效 image.width/image.height`);
  }
  if (!Number.isFinite(areaData.image?.metersPerPixel)) {
    fail(`[${label}] 缺少有效 image.metersPerPixel`);
  }
  if (!Array.isArray(areaData.places)) fail(`[${label}] places 必须是数组`);
  if (!Array.isArray(areaData.nodes)) fail(`[${label}] nodes 必须是数组`);
  if (!Array.isArray(areaData.edges)) fail(`[${label}] edges 必须是数组`);
  if (!Array.isArray(areaData.links)) fail(`[${label}] links 必须是数组`);
  checkUniqueIds(`${label} places`, areaData.places || []);
  checkUniqueIds(`${label} nodes`, areaData.nodes || []);
  checkUniqueIds(`${label} edges`, areaData.edges || []);
  for (const item of [...(areaData.places || []), ...(areaData.nodes || [])]) {
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) {
      fail(`[${label}] ${item.id} 缺少有效 x/y`);
    }
    if ('lat' in item || 'lng' in item) {
      fail(`[${label}] ${item.id} 不应再包含 lat/lng`);
    }
  }
  for (const place of (areaData.places || [])) {
    if (place.type !== 'place') fail(`[${label}] ${place.id}.type 必须为 place`);
    if (!place.label) fail(`[${label}] ${place.id} 缺少 label`);
  }
  for (const node of (areaData.nodes || [])) {
    if (node.type !== 'node') fail(`[${label}] ${node.id}.type 必须为 node`);
    if ('label' in node) fail(`[${label}] ${node.id} node 不应包含 label`);
    if ('connections' in node) fail(`[${label}] ${node.id} node 不应包含 connections，连接关系应写入 edges`);
  }
  for (const edge of (areaData.edges || [])) {
    if (edge.type !== 'edge') fail(`[${label}] ${edge.id}.type 必须为 edge`);
    if ('label' in edge) fail(`[${label}] ${edge.id} edge 不应包含 label`);
    if ('path' in edge) fail(`[${label}] ${edge.id} edge 不应包含 path，弯路应拆成多个 node 和 edge`);
  }
  for (const link of (areaData.links || [])) {
    if ('type' in link) fail(`[${label}] ${link.id}.type 应移除，连接说明请写入 label`);
    if (!link.label) fail(`[${label}] ${link.id} 缺少 label`);
  }
  report(
    `[${label}] ${areaData.places?.length || 0} 个地点，` +
    `${areaData.nodes?.length || 0} 个节点，${areaData.edges?.length || 0} 条边`
  );
}

function checkOutdoorPathNetwork(outdoorPaths, outdoorNodes, outdoorTargets, label = 'area.json') {
  if (![1, 2].includes(outdoorPaths.version)) fail(`[${label}] version 必须为 1 或 2`);
  if (outdoorPaths.coordinateSystem !== 'image-pixel') {
    fail(`[${label}] coordinateSystem 必须为 image-pixel`);
  }

  const nodes = outdoorPaths.nodes || [];
  const edges = outdoorPaths.edges || [];
  const nodeIds = checkUniqueIds(`${label} nodes`, nodes);
  checkUniqueIds(`${label} edges`, edges);

  const allowedStatus = new Set(['draft', 'reviewed', 'needs-review']);
  const statusCount = { draft: 0, reviewed: 0, 'needs-review': 0 };

  for (const node of nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      fail(`[${label}] 节点 ${node.id} 缺少有效 x/y`);
    }
  }

  for (const edge of edges) {
    if (!edge.id) continue;
    if (!nodeIds.has(edge.from)) fail(`[${label}] ${edge.id}.from 不存在: ${edge.from}`);
    if (!nodeIds.has(edge.to)) fail(`[${label}] ${edge.id}.to 不存在: ${edge.to}`);
    if (edge.type !== 'edge') fail(`[${label}] ${edge.id}.type 必须为 edge`);
    if (!allowedStatus.has(edge.reviewStatus)) {
      fail(`[${label}] ${edge.id}.reviewStatus 不合法: ${edge.reviewStatus}`);
    } else {
      statusCount[edge.reviewStatus]++;
    }
    if ('label' in edge) {
      fail(`[${label}] ${edge.id} 不应包含 label`);
    }
    if ('path' in edge) {
      fail(`[${label}] ${edge.id} 不应包含 path`);
    }
  }

  for (const target of outdoorTargets) {
    if (target.routeNodeId && !nodeIds.has(target.routeNodeId)) {
      fail(`[${label}] 地点 ${target.id}.routeNodeId 未出现在路径节点中: ${target.routeNodeId}`);
    }
  }

  report(
    `[${label}] ${nodes.length} 个节点，${edges.length} 条边；` +
    `${statusCount.reviewed} reviewed，${statusCount.draft} draft，${statusCount['needs-review']} needs-review`
  );
  if (statusCount.draft) warn(`[${label}] 存在 ${statusCount.draft} 条 draft 边，演示前建议人工审核主要路线`);
  if (statusCount['needs-review']) warn(`[${label}] 存在 ${statusCount['needs-review']} 条 needs-review 边，需要小组复核`);
}

function getOutdoorRouteCandidates(outdoorNodes) {
  return (outdoorNodes.nodes || []).map(node => ({ ...node }));
}

function findNearestOutdoorRouteNode(point, candidates) {
  let best = null;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = Graph.distanceMeters(point, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

function buildSearchItems(outdoorTargets, routeCandidates) {
  return outdoorTargets.map(target => {
    const nearest = target.routeNodeId ? { id: target.routeNodeId } :
      findNearestOutdoorRouteNode(target, routeCandidates);
    return {
      id: target.id,
      label: target.label,
      type: 'outdoor-target',
      routeNodeId: target.routeNodeId || nearest?.id
    };
  });
}

function checkRouteTargets(searchItems, graph) {
  for (const item of searchItems) {
    const routeNodeId = item.routeNodeId || item.id;
    if (!routeNodeId || !graph.getNode(routeNodeId)) {
      fail(`[搜索映射] ${item.id} 无法映射到 Graph 节点 ${routeNodeId}`);
    }
  }
  report('[搜索映射] area.json 中的地点均可映射到 Graph 节点');
}

function checkOutdoorTargets(targets, label = 'area.json places') {
  for (const target of targets) {
    if (target.type !== 'place') fail(`[${label}] ${target.id}.type 必须为 place`);
    if (!target.label) fail(`[${label}] ${target.id} 缺少 label`);
    if (!target.routeNodeId) {
      fail(`[${label}] ${target.id} 缺少 routeNodeId`);
    }
  }
}

function checkAreaBuildingLinks(targets, areaIndex, label) {
  const buildingIds = new Set(
    (areaIndex.areas || []).map(area => area.buildingId).filter(Boolean)
  );
  for (const target of targets) {
    if (target.buildingId && !buildingIds.has(target.buildingId)) {
      fail(`[${label}] ${target.id}.buildingId 未在 areas/index.json 注册: ${target.buildingId}`);
    }
  }
}

function checkRoute(graph, fromId, toId, label) {
  const result = AStar.findPath(graph, fromId, toId);
  if (!result) {
    fail(`[路线测试] ${label}: ${fromId} -> ${toId} 不可达`);
    return;
  }
  report(`[路线测试] ${label}: ${result.path.length} 个节点，约 ${Math.round(result.distance)} 米`);
}

loadScript('js/nav/graph.js');
loadScript('js/nav/astar.js');
loadScript('js/nav/outdoor-graph.js');

const areaIndex = readJson('data/areas/index.json');
const outdoorAreaEntry = (areaIndex.areas || []).find(area => area.id === areaIndex.defaultOutdoorAreaId);
const outdoorArea = outdoorAreaEntry ? readJson(outdoorAreaEntry.path) : null;
const {
  outdoorNodes,
  outdoorPaths,
  outdoorTargets
} = outdoorArea ? normalizeOutdoorArea(outdoorArea) : {
  outdoorNodes: { nodes: [], edges: [] },
  outdoorPaths: { nodes: [], edges: [] },
  outdoorTargets: []
};

checkAreaIndex(areaIndex);
if (!outdoorAreaEntry) {
  fail(`[data/areas/index.json] 找不到默认室外区域: ${areaIndex.defaultOutdoorAreaId}`);
}

function checkAreaPlaceRoutes(graph, places) {
  if (places.length < 2) {
    warn('[路线测试] area.json 少于两个地点，无法测试地点间路径');
    return;
  }
  const from = places[0];
  for (const to of places.slice(1)) {
    checkRoute(graph, from.routeNodeId, to.routeNodeId, `${from.label}到${to.label}`);
  }
}
for (const areaEntry of (areaIndex.areas || [])) {
  if (!areaEntry.path) continue;
  const areaData = readJson(areaEntry.path);
  checkAreaData(areaData, path.dirname(areaEntry.path));
  if (areaData.areaId !== areaEntry.id) {
    fail(`[data/areas/index.json] ${areaEntry.id} 指向的 area.json.areaId 为 ${areaData.areaId}`);
  }
}
checkOutdoorTargets(outdoorTargets, `${outdoorAreaEntry?.path || 'outdoor area'} places`);
checkAreaBuildingLinks(outdoorTargets, areaIndex, `${outdoorAreaEntry?.path || 'outdoor area'} places`);
checkUniqueIds(`${outdoorAreaEntry?.path || 'outdoor area'} nodes`, outdoorNodes.nodes || []);
checkConnections(`${outdoorAreaEntry?.path || 'outdoor area'} nodes`, outdoorNodes.nodes || []);
checkOutdoorPathNetwork(outdoorPaths, outdoorNodes, outdoorTargets, outdoorAreaEntry?.path || 'outdoor area');

const graph = new Graph();
const outdoorGraphBuilder = new OutdoorGraphBuilder(graph);

outdoorGraphBuilder.build(outdoorNodes.nodes || [], outdoorNodes.edges || [], outdoorPaths);

const routeCandidates = getOutdoorRouteCandidates(outdoorNodes);
const searchItems = buildSearchItems(outdoorTargets, routeCandidates);
checkRouteTargets(searchItems, graph);

checkAreaPlaceRoutes(graph, outdoorTargets);

report(`\n校验完成：${fatal.length} 个致命问题，${warnings.length} 个建议项。`);
if (fatal.length) process.exit(1);

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

function sameLatLng(point, node) {
  return Array.isArray(point) &&
    Math.abs(point[0] - node.lat) < 1e-6 &&
    Math.abs(point[1] - node.lng) < 1e-6;
}

function checkOutdoorPathNetwork(outdoorPaths, outdoorNodes, outdoorTargets) {
  if (outdoorPaths.version !== 1) fail('[outdoor-paths.json] version 必须为 1');
  if (outdoorPaths.coordinateSystem !== 'wgs84') {
    fail('[outdoor-paths.json] coordinateSystem 必须为 wgs84');
  }

  const nodes = outdoorPaths.nodes || [];
  const edges = outdoorPaths.edges || [];
  const nodeIds = checkUniqueIds('outdoor-paths.json nodes', nodes);
  checkUniqueIds('outdoor-paths.json edges', edges);

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const allowedStatus = new Set(['draft', 'reviewed', 'needs-review']);
  const allowedTypes = new Set(['walkway', 'road', 'crossing', 'stair', 'ramp', 'bridge', 'entrance-link']);
  const statusCount = { draft: 0, reviewed: 0, 'needs-review': 0 };
  const pathEdgeKeys = new Set();

  for (const node of nodes) {
    if (typeof node.lat !== 'number' || typeof node.lng !== 'number') {
      fail(`[outdoor-paths.json] 节点 ${node.id} 缺少有效 lat/lng`);
    }
  }

  for (const edge of edges) {
    if (!edge.id) continue;
    if (!nodeIds.has(edge.from)) fail(`[outdoor-paths.json] ${edge.id}.from 不存在: ${edge.from}`);
    if (!nodeIds.has(edge.to)) fail(`[outdoor-paths.json] ${edge.id}.to 不存在: ${edge.to}`);
    if (!allowedTypes.has(edge.type)) fail(`[outdoor-paths.json] ${edge.id}.type 不合法: ${edge.type}`);
    if (!allowedStatus.has(edge.reviewStatus)) {
      fail(`[outdoor-paths.json] ${edge.id}.reviewStatus 不合法: ${edge.reviewStatus}`);
    } else {
      statusCount[edge.reviewStatus]++;
    }
    if (!Array.isArray(edge.path) || edge.path.length < 2) {
      fail(`[outdoor-paths.json] ${edge.id}.path 至少需要两个 [lat, lng] 点`);
      continue;
    }
    for (const point of edge.path) {
      if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
        fail(`[outdoor-paths.json] ${edge.id}.path 点格式必须为 [lat, lng]`);
        break;
      }
    }

    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    if (fromNode && toNode) {
      pathEdgeKeys.add(edgeKey(edge.from, edge.to));
      if (!sameLatLng(edge.path[0], fromNode)) {
        warn(`[outdoor-paths.json] ${edge.id}.path 首点未贴合 from 节点 ${edge.from}`);
      }
      if (!sameLatLng(edge.path[edge.path.length - 1], toNode)) {
        warn(`[outdoor-paths.json] ${edge.id}.path 末点未贴合 to 节点 ${edge.to}`);
      }
    }
  }

  const oldEdgeKeys = new Set((outdoorNodes.edges || []).map(edge => edgeKey(edge.from, edge.to)));
  const missingPathEdges = [...oldEdgeKeys].filter(key => !pathEdgeKeys.has(key));
  if (missingPathEdges.length) {
    warn(`[outdoor-paths.json] 有 ${missingPathEdges.length} 条 outdoor-nodes.json 边尚未提供 edge.path，渲染会退回直线`);
  }

  for (const target of outdoorTargets) {
    if (target.routeNodeId && !nodeIds.has(target.routeNodeId)) {
      fail(`[outdoor-targets.json] ${target.id}.routeNodeId 未出现在 outdoor-paths.json nodes: ${target.routeNodeId}`);
    }
  }

  report(
    `[outdoor-paths.json] ${nodes.length} 个节点，${edges.length} 条路径边；` +
    `${statusCount.reviewed} reviewed，${statusCount.draft} draft，${statusCount['needs-review']} needs-review`
  );
  if (statusCount.draft) warn(`[outdoor-paths.json] 存在 ${statusCount.draft} 条 draft 路径边，演示前建议人工审核主要路线`);
  if (statusCount['needs-review']) warn(`[outdoor-paths.json] 存在 ${statusCount['needs-review']} 条 needs-review 路径边，需要小组复核`);
}

function getOutdoorRouteCandidates(buildings, outdoorNodes) {
  const roads = (outdoorNodes.nodes || []).map(node => ({ ...node }));
  const entrances = buildings
    .filter(building => building.entrance)
    .map(building => ({
      id: `entrance-${building.id}`,
      lat: building.entrance.lat,
      lng: building.entrance.lng,
      label: `${building.name}入口`
    }));
  return [...roads, ...entrances];
}

function findNearestOutdoorRouteNode(point, candidates) {
  let best = null;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = Graph.haversine(point.lat, point.lng, candidate.lat, candidate.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

function buildSearchItems(buildings, outdoorTargets, routeCandidates) {
  const items = [];
  for (const building of buildings) {
    items.push({
      id: building.id,
      label: building.name,
      type: 'building',
      routeNodeId: `entrance-${building.id}`
    });
  }
  for (const target of outdoorTargets) {
    const nearest = target.routeNodeId ? { id: target.routeNodeId } :
      findNearestOutdoorRouteNode(target, routeCandidates);
    items.push({
      id: target.id,
      label: target.name,
      type: 'outdoor-target',
      routeNodeId: target.routeNodeId || nearest?.id
    });
  }
  return items;
}

function checkRouteTargets(searchItems, graph) {
  for (const item of searchItems) {
    const routeNodeId = item.routeNodeId || item.id;
    if (!routeNodeId || !graph.getNode(routeNodeId)) {
      fail(`[搜索映射] ${item.id} 无法映射到 Graph 节点 ${routeNodeId}`);
    }
  }
  report('[搜索映射] 建筑与室外目标均可映射到 Graph 节点');
}

function checkOutdoorTargets(targets) {
  const allowedTypes = new Set(['gate', 'transit', 'canteen', 'shop', 'parking', 'landmark']);
  for (const target of targets) {
    if (!allowedTypes.has(target.type)) {
      fail(`[outdoor-targets.json] ${target.id} 使用了不允许的总地图目标类型: ${target.type}`);
    }
    if (!target.routeNodeId) {
      fail(`[outdoor-targets.json] ${target.id} 缺少 routeNodeId`);
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
loadScript('js/nav/indoor-graph.js');

const buildings = readJson('data/buildings.json');
const outdoorNodes = readJson('data/outdoor-nodes.json');
const outdoorPaths = readJson('data/outdoor-paths.json');
const outdoorTargets = readJson('data/outdoor-targets.json');
const indoorDir = path.join(root, 'data/indoor');
const indoorFiles = fs.readdirSync(indoorDir).filter(file => file.endsWith('.json'));

checkUniqueIds('buildings.json', buildings);
checkUniqueIds('outdoor-targets.json', outdoorTargets);
checkOutdoorTargets(outdoorTargets);
checkUniqueIds('outdoor-nodes.json', outdoorNodes.nodes || []);
checkConnections('outdoor-nodes.json', outdoorNodes.nodes || []);
checkOutdoorPathNetwork(outdoorPaths, outdoorNodes, outdoorTargets);

const graph = new Graph();
const outdoorGraphBuilder = new OutdoorGraphBuilder(graph);
const indoorGraphBuilder = new IndoorGraphBuilder(graph);

outdoorGraphBuilder.build(outdoorNodes.nodes || [], outdoorNodes.edges || [], outdoorPaths);
for (const building of buildings) {
  if (building.entrance?.nearestRoadNode && !graph.getNode(building.entrance.nearestRoadNode)) {
    fail(`[建筑入口] ${building.id}.entrance.nearestRoadNode 不存在: ${building.entrance.nearestRoadNode}`);
  }
  outdoorGraphBuilder.registerBuildingEntrance(building);
}

for (const file of indoorFiles) {
  const buildingId = path.basename(file, '.json');
  const indoorData = readJson(path.join('data/indoor', file));
  const nodes = indoorData.nodes || [];
  const floors = indoorData.floors || [];
  const floorLevels = floors
    .map(floor => typeof floor === 'number' ? floor : floor.level)
    .filter(floor => typeof floor === 'number');

  checkUniqueIds(`indoor/${file}`, nodes);
  checkConnections(`indoor/${file}`, nodes);
  if (!floorLevels.length) fail(`[indoor/${file}] floors 缺少有效 level`);
  if (indoorData.entranceLink && !nodes.some(node => node.id === indoorData.entranceLink)) {
    fail(`[indoor/${file}] entranceLink 不存在: ${indoorData.entranceLink}`);
  }
  indoorGraphBuilder.build(buildingId, indoorData);
}

const routeCandidates = getOutdoorRouteCandidates(buildings, outdoorNodes);
const searchItems = buildSearchItems(buildings, outdoorTargets, routeCandidates);
checkRouteTargets(searchItems, graph);

checkRoute(graph, 'gate-south', 'entrance-yifu', '南门到逸夫楼入口');
checkRoute(graph, 'gate-south', 'yifu-3f-room-A301', '南门到逸夫楼 A301');
checkRoute(graph, 'yifu-1f-entrance', 'yifu-3f-facility-bathroom', '逸夫楼入口到 3F 卫生间');
checkRoute(graph, 'lib-1f-entrance', 'lib-5f-5333-donation', '图书馆 1F 到 5F 名人赠阅区');
checkRoute(graph, 'entrance-library', 'entrance-xian1', '图书馆到仙I教学楼');

report(`\n校验完成：${fatal.length} 个致命问题，${warnings.length} 个建议项。`);
if (fatal.length) process.exit(1);

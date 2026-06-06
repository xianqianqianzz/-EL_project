const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const fatal = [];
const suggestions = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function loadScript(relativePath) {
  vm.runInThisContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), { filename: relativePath });
}

function fail(message) {
  fatal.push(message);
  console.error(`fatal: ${message}`);
}

function suggest(message) {
  suggestions.push(message);
  console.warn(`suggestion: ${message}`);
}

function validateArea(entry, area) {
  const name = entry.path;
  if (area.version !== 2) fail(`[${name}] version 必须为 2`);
  if (area.areaId !== entry.id) fail(`[${name}] areaId 与索引 ID 不一致`);
  if (area.coordinateSystem !== 'image-pixel') fail(`[${name}] coordinateSystem 必须为 image-pixel`);
  if (!area.image?.path || !Number.isFinite(area.image.width) || !Number.isFinite(area.image.height)) {
    fail(`[${name}] image.path/width/height 不完整`);
  } else if (!fs.existsSync(path.join(root, path.dirname(entry.path), area.image.path))) {
    fail(`[${name}] 地图图片不存在：${area.image.path}`);
  }

  const ids = new Set();
  for (const node of (area.nodes || [])) {
    if (!node.id || ids.has(node.id)) fail(`[${name}] 节点 ID 缺失或重复：${node.id || '?'}`);
    ids.add(node.id);
    if (node.type !== 'node') fail(`[${name}] ${node.id}.type 必须为 node`);
    if (![node.x, node.y].every(Number.isFinite)) fail(`[${name}] ${node.id} 缺少有效 x/y`);
    if ('label' in node || 'connections' in node) fail(`[${name}] ${node.id} 不应包含 label/connections`);
  }

  const edgeIds = new Set();
  let draftEdges = 0;
  for (const edge of (area.edges || [])) {
    if (!edge.id || edgeIds.has(edge.id)) fail(`[${name}] 边 ID 缺失或重复：${edge.id || '?'}`);
    edgeIds.add(edge.id);
    if (edge.type !== 'edge') fail(`[${name}] ${edge.id}.type 必须为 edge`);
    if (!ids.has(edge.from) || !ids.has(edge.to)) fail(`[${name}] ${edge.id} 引用了不存在的节点`);
    if ('label' in edge || 'path' in edge) fail(`[${name}] ${edge.id} 不应包含 label/path`);
    if (edge.reviewStatus === 'draft') draftEdges++;
  }

  const placeIds = new Set();
  for (const place of (area.places || [])) {
    if (!place.id || placeIds.has(place.id)) fail(`[${name}] place ID 缺失或重复：${place.id || '?'}`);
    placeIds.add(place.id);
    if (place.type !== 'place' || !place.label) fail(`[${name}] ${place.id} 必须是带 label 的 place`);
    if (!ids.has(place.routeNodeId)) fail(`[${name}] ${place.id}.routeNodeId 无效`);
  }

  console.log(`[${name}] ${(area.places || []).length} places, ${(area.nodes || []).length} nodes, ${(area.edges || []).length} edges`);
  if (draftEdges) suggest(`[${name}] ${draftEdges} 条边仍为 draft，演示前应人工复核`);
}

loadScript('js/nav/graph.js');
loadScript('js/nav/astar.js');
loadScript('js/nav/outdoor-graph.js');

const index = readJson('data/areas/index.json');
if (index.version !== 1) fail('[data/areas/index.json] version 必须为 1');
const entries = index.areas || [];
const defaultEntry = entries.find(entry => entry.id === index.defaultOutdoorAreaId);
if (!defaultEntry) fail('[data/areas/index.json] defaultOutdoorAreaId 无效');

for (const entry of entries) validateArea(entry, readJson(entry.path));

if (defaultEntry) {
  const area = readJson(defaultEntry.path);
  const graph = new Graph();
  new OutdoorGraphBuilder(graph).build(area.nodes || [], area.edges || [], area.image?.metersPerPixel || 1);
  const places = area.places || [];
  if (places.length >= 2) {
    const from = places[0];
    for (const to of places.slice(1)) {
      const result = AStar.findPath(graph, from.routeNodeId, to.routeNodeId);
      if (!result) fail(`[route] ${from.label}到${to.label}不可达`);
      else console.log(`[route] ${from.label}到${to.label}: ${result.path.length} nodes, approx ${Math.round(result.distance)} m`);
    }
  }
}

console.log(`\n校验完成：${fatal.length} fatal, ${suggestions.length} suggestion`);
if (fatal.length) process.exit(1);

(async function initApp() {
  const emptyPanel = document.getElementById('panel-empty');
  if (typeof L === 'undefined') {
    emptyPanel.textContent = 'Leaflet 未加载，无法显示地图。';
    return;
  }

  let areaIndex;
  let areaEntry;
  let area;
  try {
    areaIndex = await DataLoader.loadFirstJSON(CONFIG.dataPaths.areasIndex);
    areaEntry = (areaIndex.areas || []).find(item => item.id === areaIndex.defaultOutdoorAreaId);
    if (!areaEntry) throw new Error('areas/index.json 未指定有效的默认室外区域');
    const areaPath = areaEntry.dataUrl || areaEntry.path;
    if (!areaPath) throw new Error(`区域 ${areaEntry.id} 未指定有效数据地址`);
    area = DataLoader.normalizeOutdoorArea(await DataLoader.loadJSON(areaPath));
    const problems = DataValidator.validateArea(area);
    if (problems.length) console.warn('[Area 校验]', problems);
    areaEntry.resolvedDataPath = areaPath;
  } catch (error) {
    console.error(error);
    emptyPanel.textContent = `区域数据加载失败：${error.message}`;
    return;
  }

  const graph = new Graph();
  const graphBuilder = new OutdoorGraphBuilder(graph);
  const imagePath = areaEntry.mapUrl ||
    DataLoader.resolveAssetPath(areaEntry.resolvedDataPath, area.image.path);
  const map = new OutdoorMap('outdoor-map', area, imagePath);
  const searchBox = new SearchBox();
  const infoPanel = new InfoPanel();
  const pathRenderer = new PathRenderer();
  const placeByNodeId = new Map(area.places.map(place => [place.routeNodeId, place]));

  const selectableNodes = area.nodes.map((node, index) => {
    const place = placeByNodeId.get(node.id);
    return {
      id: node.id,
      routeNodeId: node.id,
      type: 'node',
      label: place?.label || `路网节点 ${String(index + 1).padStart(3, '0')}`,
      x: node.x,
      y: node.y,
      floor: 0
    };
  });
  const itemByNodeId = new Map(selectableNodes.map(item => [item.id, item]));
  const searchItems = area.places.map(place => ({
    ...place,
    keywords: [place.label],
    floor: 0
  }));

  graphBuilder.build(area.nodes, area.edges, area.image.metersPerPixel);
  for (const item of selectableNodes) {
    const node = graph.getNode(item.id);
    if (node) node.label = item.label;
  }
  map.renderPlaces(area.places);
  searchBox.buildIndex(searchItems);

  let selectionRole = null;
  const selectFromButton = document.getElementById('btn-select-from');
  const selectToButton = document.getElementById('btn-select-to');
  const selectionBanner = document.getElementById('map-selection-banner');
  const selectionText = document.getElementById('map-selection-text');

  function startSelection(role) {
    selectionRole = role;
    selectFromButton.classList.toggle('active', role === 'from');
    selectToButton.classList.toggle('active', role === 'to');
    selectionText.textContent = role === 'from' ? '请选择起点路网节点' : '请选择终点路网节点';
    selectionBanner.classList.remove('hidden');
    map.showSelectableNodes(selectableNodes, role, selectNode);
  }

  function stopSelection() {
    selectionRole = null;
    selectFromButton.classList.remove('active');
    selectToButton.classList.remove('active');
    selectionBanner.classList.add('hidden');
    map.hideSelectableNodes();
  }

  function selectNode(item) {
    if (!selectionRole) return;
    const role = selectionRole;
    stopSelection();
    searchBox.setRole(role, item);
  }

  function doRouteSearch() {
    const fromId = searchBox.fromNode?.routeNodeId || searchBox.fromNode?.id;
    const toId = searchBox.toNode?.routeNodeId || searchBox.toNode?.id;
    if (!fromId || !toId) {
      alert('请先选择起点和终点。');
      return;
    }
    const result = AStar.findPath(graph, fromId, toId);
    if (!result) {
      alert('当前两个节点之间没有可达路径，请检查连边数据。');
      return;
    }
    pathRenderer.drawOutdoor(map.map, result.path);
    infoPanel.showRoute({ ...result, totalDistance: result.distance });
  }

  searchBox.onChange(() => {
    if (searchBox.fromNode && searchBox.toNode) doRouteSearch();
  });
  selectFromButton.addEventListener('click', () => startSelection('from'));
  selectToButton.addEventListener('click', () => startSelection('to'));
  document.getElementById('btn-cancel-selection').addEventListener('click', stopSelection);
  document.getElementById('btn-route').addEventListener('click', doRouteSearch);
  document.getElementById('btn-swap').addEventListener('click', () => {
    searchBox.swap();
    if (searchBox.fromNode && searchBox.toNode) doRouteSearch();
  });
  map.onPlaceClick(place => {
    if (!selectionRole) return false;
    const item = searchItems.find(candidate => candidate.id === place.id) ||
      itemByNodeId.get(place.routeNodeId);
    if (item) selectNode(item);
    return Boolean(item);
  });

  console.log(`[App] 已加载 ${area.name}：${area.places.length} places，${area.nodes.length} nodes，${area.edges.length} edges`);
})();

/**
 * 应用入口 — 模块协调与初始化
 */
(async function() {
  if (typeof L === 'undefined') {
    console.error('Leaflet 未加载，室外地图无法初始化。请检查网络，或将 Leaflet 本地文件放入 lib/leaflet 后更新 index.html。');
    const emptyPanel = document.getElementById('panel-empty');
    if (emptyPanel) {
      emptyPanel.textContent = '地图依赖 Leaflet 未加载，请检查网络连接或改用本地 Leaflet 文件。';
    }
    return;
  }

  // ========== 初始化模块 ==========
  const graph = new Graph();
  const outdoorMap = new OutdoorMap('outdoor-map');
  const indoorMap = new IndoorMap('indoor-canvas');
  const layerSwitch = new LayerSwitch(outdoorMap, indoorMap);
  const searchBox = new SearchBox();
  const infoPanel = new InfoPanel();
  const pathRenderer = new PathRenderer();
  const markerPopup = new MarkerPopup(searchBox);

  const outdoorGraphBuilder = new OutdoorGraphBuilder(graph);
  const indoorGraphBuilder = new IndoorGraphBuilder(graph);
  const indoorDataCache = new Map();
  const indexedIndoorBuildings = new Set();

  // ========== 加载数据 ==========
  let buildings, outdoorNodes, outdoorPaths, outdoorTargets;

  try {
    [buildings, outdoorNodes, outdoorPaths, outdoorTargets] = await DataLoader.loadAll([
      CONFIG.dataPaths.buildings,
      CONFIG.dataPaths.outdoorNodes,
      CONFIG.dataPaths.outdoorPaths,
      CONFIG.dataPaths.outdoorTargets
    ]);
    DataValidator.report('建筑', buildings, DataValidator.validateBuilding);
    DataValidator.report('室外节点', outdoorNodes.nodes || [], DataValidator.validateGraphNode);
    DataValidator.report('室外边', outdoorNodes.edges || [], DataValidator.validateEdge);
    DataValidator.reportUniqueIds('室外节点', outdoorNodes.nodes || []);
    DataValidator.reportConnections('室外连接', outdoorNodes.nodes || []);
    if (DataValidator.reportOutdoorPathNetwork) {
      DataValidator.reportOutdoorPathNetwork(outdoorPaths);
    }
  } catch (err) {
    console.error('数据加载失败:', err);
    document.getElementById('panel-empty').textContent = '数据加载失败，请检查 data 目录。';
    return;
  }

  // ========== 构建搜索索引 ==========
  const searchItems = [];
  for (const b of buildings) {
    searchItems.push({
      id: b.id, label: b.name, type: 'building',
      building: b.name, buildingId: b.id, routeNodeId: `entrance-${b.id}`,
      keywords: [b.name, ...(b.aliases || [])],
      lat: b.entrance?.lat || b.center?.lat,
      lng: b.entrance?.lng || b.center?.lng,
      floor: 0
    });
  }
  for (const target of outdoorTargets) {
    const nearest = target.routeNodeId ? { id: target.routeNodeId } : findNearestOutdoorRouteNode(target);
    searchItems.push({
      id: target.id, label: target.name, type: 'outdoor-target',
      routeNodeId: target.routeNodeId || nearest?.id,
      keywords: [target.name, target.label, target.type, ...(target.aliases || [])].filter(Boolean),
      lat: target.lat, lng: target.lng, floor: 0
    });
  }
  searchBox.buildIndex(searchItems);

  // ========== 渲染地图 ==========
  outdoorMap.renderBuildings(buildings);
  outdoorMap.renderOutdoorTargets(outdoorTargets);
  pathRenderer.setOutdoorPathNetwork(outdoorPaths);

  // ========== 构建室外图 ==========
  outdoorGraphBuilder.build(outdoorNodes.nodes || [], outdoorNodes.edges || [], outdoorPaths);
  for (const b of buildings) {
    outdoorGraphBuilder.registerBuildingEntrance(b);
  }
  if (DataValidator.reportRouteTargets) {
    DataValidator.reportRouteTargets('搜索条目', searchItems, graph);
  }

  // ========== 事件绑定 ==========

  // 搜索框：起终点变化
  searchBox.onChange((role) => {
    if (searchBox.fromNode && searchBox.toNode) {
      doRouteSearch();
    }
  });

  // 路线规划按钮
  document.getElementById('btn-route').addEventListener('click', () => {
    if (searchBox.fromNode && searchBox.toNode) doRouteSearch();
  });

  // 交换起终点
  document.getElementById('btn-swap').addEventListener('click', () => {
    searchBox.swap();
    if (searchBox.fromNode && searchBox.toNode) doRouteSearch();
  });

  // 建筑点击 → 显示建筑信息
  outdoorMap.onBuildingClick((building) => {
    infoPanel.showBuilding(building);
  });

  // 地图点击 → 设为起点/终点
  outdoorMap.map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    const nearest = findNearestOutdoorRouteNode({ lat, lng });
    // 创建临时室外选点条目，寻路时吸附到最近室外路网节点
    const item = {
      id: `map-point-${Date.now()}`,
      label: nearest ? `地图选点（靠近${nearest.label || nearest.id}）` :
                       `(${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      type: 'custom',
      routeNodeId: nearest?.id,
      lat, lng, floor: 0
    };
    markerPopup.handleItemClick(item);
  });

  // 进入室内地图
  infoPanel.onEnterBuilding(async (building) => {
    try {
      const indoorData = await loadIndoorForBuilding(building);
      layerSwitch.enterIndoor(building, indoorData);
    } catch (err) {
      console.error('加载室内数据失败:', err);
      alert(`暂无 "${building.name}" 的室内地图数据。`);
    }
  });

  // 返回室外
  document.getElementById('btn-back-outdoor').addEventListener('click', () => {
    layerSwitch.exitToOutdoor();
    infoPanel.showEmpty();
  });

  // 图层切换回调
  layerSwitch.onSwitch((mode) => {
    if (mode === 'outdoor') infoPanel.showEmpty();
  });

  // ========== 核心：路径规划 ==========
  async function doRouteSearch() {
    const fromItem = searchBox.fromNode;
    const toItem = searchBox.toNode;
    const fromId = resolveRouteNodeId(fromItem);
    const toId = resolveRouteNodeId(toItem);

    if (!fromId || !toId) {
      alert('起点或终点没有可用于寻路的节点，请重新选择。');
      return;
    }

    try {
      await ensureSearchItemLoaded(fromItem);
      await ensureSearchItemLoaded(toItem);
    } catch (err) {
      console.error('自动加载室内数据失败:', err);
      alert('室内数据加载失败，请先点击对应建筑进入室内地图。');
      return;
    }

    const result = AStar.findPath(graph, fromId, toId);
    if (!result) {
      alert('未找到可达路径，请确认起终点之间的路网连通。');
      return;
    }

    pathRenderer.drawOutdoor(outdoorMap.map, result.path);

    const segs = PathRenderer.segmentPath(result.path);
    const indoorSeg = segs.find(s => s.type === 'indoor');
    if (indoorSeg && layerSwitch.mode === 'outdoor') {
      const buildingId = indoorSeg.nodes[0]?.building;
      const building = buildings.find(b => b.id === buildingId);
      if (building) {
        const indoorData = await loadIndoorForBuilding(building);
        layerSwitch.enterIndoor(building, indoorData, indoorSeg.floor);
        indoorMap.render(result.path);
      }
    }
    if (layerSwitch.mode === 'indoor') {
      indoorMap.render(result.path);
    }

    infoPanel.showRoute({ ...result, totalDistance: result.distance });
  }

  function resolveRouteNodeId(item) {
    return item?.routeNodeId || item?.id;
  }

  async function ensureSearchItemLoaded(item) {
    const routeNodeId = resolveRouteNodeId(item);
    if (!routeNodeId || graph.getNode(routeNodeId)) return;

    const building = findBuildingForSearchItem(item, routeNodeId);
    if (!building || !building.indoorAvailable) return;
    await loadIndoorForBuilding(building);
  }

  async function loadIndoorForBuilding(building) {
    let indoorData = indoorDataCache.get(building.id);
    if (!indoorData) {
      indoorData = await DataLoader.loadIndoor(building.id);
      indoorDataCache.set(building.id, indoorData);
      if (DataValidator.reportIndoorData) {
        DataValidator.reportIndoorData(building.id, indoorData);
      }
    }
    indoorGraphBuilder.build(building.id, indoorData);
    indexIndoorTargets(building, indoorData);
    return indoorData;
  }

  function indexIndoorTargets(building, indoorData) {
    if (indexedIndoorBuildings.has(building.id)) return;
    const existingIds = new Set(searchItems.map(item => item.id));
    for (const n of (indoorData.nodes || [])) {
      if (!['room', 'facility'].includes(n.type) || existingIds.has(n.id)) continue;
      const item = MarkerPopup.nodeToItem({ ...n, building: building.id });
      item.building = building.name;
      item.buildingId = building.id;
      item.routeNodeId = n.id;
      item.keywords = [n.label, building.name, building.id].filter(Boolean);
      searchItems.push(item);
      existingIds.add(n.id);
    }
    indexedIndoorBuildings.add(building.id);
    searchBox.buildIndex(searchItems);
  }

  function findBuildingForSearchItem(item, routeNodeId) {
    return buildings.find(b =>
      item?.buildingId === b.id ||
      item?.building === b.name ||
      item?.building === b.id ||
      routeNodeId === `entrance-${b.id}` ||
      routeNodeId.startsWith(`${b.id}-`)
    );
  }

  function findNearestOutdoorRouteNode(point) {
    const candidates = getOutdoorRouteCandidates();
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

  function getOutdoorRouteCandidates() {
    const roadNodes = (outdoorNodes.nodes || []).map(n => ({ ...n }));
    const entrances = buildings
      .filter(b => b.entrance)
      .map(b => ({
        id: `entrance-${b.id}`,
        type: 'entrance',
        lat: b.entrance.lat,
        lng: b.entrance.lng,
        label: `${b.name}入口`
      }));
    return [...roadNodes, ...entrances];
  }

  console.log('[App] 南京大学智能校园地图初始化完成');
  console.log(`[App] 图规模: ${graph.size()} 个节点`);
})();

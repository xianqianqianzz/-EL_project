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

  const outdoorGraphBuilder = new OutdoorGraphBuilder(graph);
  const indoorGraphBuilder = new IndoorGraphBuilder(graph);
  const indoorDataCache = new Map();
  const indexedIndoorBuildings = new Set();

  // ========== 加载数据 ==========
  let buildings, areaIndex, outdoorArea, outdoorAreaEntry, outdoorNodes, outdoorPaths, outdoorTargets;

  try {
    areaIndex = await DataLoader.loadJSON(CONFIG.dataPaths.areasIndex);
    outdoorAreaEntry = (areaIndex.areas || [])
      .find(area => area.id === areaIndex.defaultOutdoorAreaId);
    if (!outdoorAreaEntry?.path) {
      throw new Error(`找不到默认室外区域: ${areaIndex.defaultOutdoorAreaId || '未设置'}`);
    }
    outdoorArea = await DataLoader.loadJSON(outdoorAreaEntry.path);
    const buildingEntries = new Map();
    for (const area of (areaIndex.areas || [])) {
      if (!area.buildingId || buildingEntries.has(area.buildingId)) continue;
      buildingEntries.set(area.buildingId, {
        id: area.buildingId,
        name: area.buildingName || area.name || area.buildingId,
        description: area.description || '',
        indoorAvailable: true
      });
    }
    buildings = [...buildingEntries.values()];
    ({ outdoorNodes, outdoorPaths, outdoorTargets } = DataLoader.normalizeOutdoorArea(outdoorArea));
    DataValidator.report('建筑', buildings, DataValidator.validateBuilding);
    if (DataValidator.reportAreaData) {
      DataValidator.reportAreaData(outdoorArea);
    }
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
  const buildingById = new Map(buildings.map(building => [building.id, building]));
  const outdoorPlaceByBuildingId = new Map(
    outdoorTargets.filter(place => place.buildingId).map(place => [place.buildingId, place])
  );
  const searchItems = outdoorTargets.map(target => {
    const building = target.buildingId ? buildingById.get(target.buildingId) : null;
    const nearest = target.routeNodeId ? { id: target.routeNodeId } : findNearestOutdoorRouteNode(target);
    return {
      id: target.id,
      label: target.label,
      type: building ? 'building' : 'outdoor-target',
      building: building?.name,
      buildingId: building?.id,
      routeNodeId: target.routeNodeId || nearest?.id,
      keywords: [target.label, building?.name, ...(building?.aliases || [])].filter(Boolean),
      x: target.x,
      y: target.y,
      floor: 0
    };
  });
  const searchItemByPlaceId = new Map(searchItems.map(item => [item.id, item]));
  const searchItemByRouteNodeId = new Map(
    searchItems.map(item => [item.routeNodeId, item])
  );
  const selectableNodeItems = (outdoorNodes.nodes || []).map((node, index) => {
    const placeItem = searchItemByRouteNodeId.get(node.id);
    return {
      ...(placeItem || {
        id: `select-${node.id}`,
        label: `路网节点 ${String(index + 1).padStart(3, '0')}`,
        type: 'custom',
        routeNodeId: node.id,
        floor: 0
      }),
      x: node.x,
      y: node.y
    };
  });
  const selectableNodeItemById = new Map(
    selectableNodeItems.map(item => [item.routeNodeId, item])
  );
  searchBox.buildIndex(searchItems);

  // ========== 渲染地图 ==========
  outdoorMap.configureArea(outdoorArea, outdoorAreaEntry.path);
  outdoorMap.renderBuildings(buildings, outdoorTargets);
  outdoorMap.renderOutdoorTargets(outdoorTargets);
  // ========== 构建室外图 ==========
  outdoorGraphBuilder.build(outdoorNodes.nodes || [], outdoorNodes.edges || [], outdoorPaths);
  if (DataValidator.reportRouteTargets) {
    DataValidator.reportRouteTargets('搜索条目', searchItems, graph);
  }

  // ========== 事件绑定 ==========
  const selectFromButton = document.getElementById('btn-select-from');
  const selectToButton = document.getElementById('btn-select-to');
  const cancelSelectionButton = document.getElementById('btn-cancel-selection');
  const selectionBanner = document.getElementById('map-selection-banner');
  const selectionText = document.getElementById('map-selection-text');
  let selectionRole = null;

  // 搜索框：起终点变化
  searchBox.onChange((role) => {
    endMapSelection();
    if (searchBox.fromNode && searchBox.toNode) {
      doRouteSearch();
    }
  });

  selectFromButton.addEventListener('click', () => beginMapSelection('from'));
  selectToButton.addEventListener('click', () => beginMapSelection('to'));
  cancelSelectionButton.addEventListener('click', endMapSelection);

  // 路线规划按钮
  document.getElementById('btn-route').addEventListener('click', () => {
    if (searchBox.fromNode && searchBox.toNode) doRouteSearch();
  });

  // 交换起终点
  document.getElementById('btn-swap').addEventListener('click', () => {
    endMapSelection();
    searchBox.swap();
    if (searchBox.fromNode && searchBox.toNode) doRouteSearch();
  });

  // 建筑点击 → 显示建筑信息
  outdoorMap.onBuildingClick((building) => {
    const place = outdoorPlaceByBuildingId.get(building.id);
    const item = place ? searchItemByPlaceId.get(place.id) : null;
    if (selectionRole && item) {
      selectMapItem(item);
      return;
    }
    infoPanel.showBuilding(building);
  });
  outdoorMap.onMapClick((place) => {
    const item = searchItemByPlaceId.get(place.id);
    if (selectionRole && item) selectMapItem(item);
  });

  // 选择模式下点击地图空白处，吸附到最近路网节点。
  outdoorMap.map.on('click', (e) => {
    if (!selectionRole) return;
    const point = { x: e.latlng.lng, y: -e.latlng.lat, metersPerPixel: outdoorPaths.metersPerPixel };
    const nearest = findNearestOutdoorRouteNode(point);
    const item = nearest ? selectableNodeItemById.get(nearest.id) : null;
    if (item) selectMapItem(item);
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

    infoPanel.showRoute({
      ...result,
      totalDistance: result.distance,
      fromLabel: fromItem.label,
      toLabel: toItem.label
    });
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
      indoorData = await DataLoader.loadIndoor(building.id, areaIndex);
      indoorDataCache.set(building.id, indoorData);
      if (DataValidator.reportIndoorData) {
        DataValidator.reportIndoorData(building.id, indoorData);
      }
    }
    indoorGraphBuilder.build(
      building.id,
      indoorData,
      outdoorPlaceByBuildingId.get(building.id)?.routeNodeId
    );
    indexIndoorTargets(building, indoorData);
    return indoorData;
  }

  function indexIndoorTargets(building, indoorData) {
    if (indexedIndoorBuildings.has(building.id)) return;
    const existingIds = new Set(searchItems.map(item => item.id));
    for (const n of (indoorData.nodes || [])) {
      if (!['room', 'facility'].includes(n.type) || existingIds.has(n.id)) continue;
      const item = nodeToSearchItem({ ...n, building: building.id });
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
      routeNodeId === outdoorPlaceByBuildingId.get(b.id)?.routeNodeId ||
      routeNodeId?.startsWith(`${b.id}-`)
    );
  }

  function findNearestOutdoorRouteNode(point) {
    const candidates = getOutdoorRouteCandidates();
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

  function getOutdoorRouteCandidates() {
    return (outdoorNodes.nodes || []).map(n => ({
      ...n,
      metersPerPixel: outdoorPaths.metersPerPixel
    }));
  }

  function nodeToSearchItem(node) {
    return {
      id: node.id,
      label: node.label || node.id,
      type: node.type,
      building: node.building || undefined,
      buildingId: node.building || undefined,
      routeNodeId: node.id,
      x: node.x,
      y: node.y,
      floor: node.floor || 0
    };
  }

  function beginMapSelection(role) {
    if (selectionRole === role) {
      endMapSelection();
      return;
    }
    selectionRole = role;
    selectFromButton.classList.toggle('active', role === 'from');
    selectToButton.classList.toggle('active', role === 'to');
    selectionText.textContent = role === 'from' ?
      '请选择起点：点击绿色路网节点或已标注地点' :
      '请选择终点：点击红色路网节点或已标注地点';
    selectionBanner.classList.remove('hidden');
    outdoorMap.showSelectableNodes(selectableNodeItems, role, selectMapItem);
  }

  function endMapSelection() {
    selectionRole = null;
    selectFromButton.classList.remove('active');
    selectToButton.classList.remove('active');
    selectionBanner.classList.add('hidden');
    outdoorMap.hideSelectableNodes();
  }

  function selectMapItem(item) {
    if (!selectionRole) return;
    const role = selectionRole;
    endMapSelection();
    searchBox.setRole(role, item);
  }

  console.log('[App] 南京大学智能校园地图初始化完成');
  console.log(`[App] 图规模: ${graph.size()} 个节点`);
})();

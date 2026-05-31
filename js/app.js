/**
 * 应用入口 — 模块协调与初始化
 */
(async function() {
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

  // ========== 加载数据 ==========
  let buildings, outdoorNodes, pois;

  try {
    [buildings, outdoorNodes, pois] = await DataLoader.loadAll([
      CONFIG.dataPaths.buildings,
      CONFIG.dataPaths.outdoorNodes,
      CONFIG.dataPaths.poi
    ]);
    DataValidator.report('建筑', buildings, DataValidator.validateBuilding);
    DataValidator.report('室外节点', outdoorNodes.nodes || [], DataValidator.validateGraphNode);
    DataValidator.report('室外边', outdoorNodes.edges || [], DataValidator.validateEdge);
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
      building: b.name, keywords: [b.name, ...(b.aliases || [])],
      lat: b.entrance?.lat || b.center?.lat,
      lng: b.entrance?.lng || b.center?.lng,
      floor: 0
    });
  }
  for (const p of pois) {
    searchItems.push({
      id: p.id, label: p.name, type: 'poi',
      keywords: [p.name, ...(p.aliases || [])],
      lat: p.lat, lng: p.lng, floor: 0
    });
  }
  searchBox.buildIndex(searchItems);

  // ========== 渲染地图 ==========
  outdoorMap.renderBuildings(buildings);
  outdoorMap.renderPOIs(pois);

  // ========== 构建室外图 ==========
  outdoorGraphBuilder.build(outdoorNodes.nodes || [], outdoorNodes.edges || []);
  for (const b of buildings) {
    outdoorGraphBuilder.registerBuildingEntrance(b);
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
    // 创建临时 POI 条目
    const item = {
      id: `map-point-${Date.now()}`,
      label: `(${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      type: 'custom',
      lat, lng, floor: 0
    };
    markerPopup.handleItemClick(item);
  });

  // 进入室内地图
  infoPanel.onEnterBuilding(async (building) => {
    try {
      const indoorData = await DataLoader.loadIndoor(building.id);
      indoorGraphBuilder.build(building.id, indoorData);

      // 将室内房间加入搜索索引
      for (const n of (indoorData.nodes || [])) {
        if (n.type === 'room') {
          searchItems.push(MarkerPopup.nodeToItem(n));
        }
      }
      searchBox.buildIndex(searchItems);

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
  function doRouteSearch() {
    const fromId = searchBox.fromNode.id;
    const toId = searchBox.toNode.id;

    // 如果目标在室内但室内图未加载，自动加载
    const toNode = graph.getNode(toId);
    if (!toNode) {
      // 目标节点不在图中（可能是室内房间未加载）
      const building = buildings.find(b =>
        searchBox.toNode.building === b.name || searchBox.toNode.building === b.id
      );
      if (building) {
        DataLoader.loadIndoor(building.id).then(indoorData => {
          indoorGraphBuilder.build(building.id, indoorData);
          executeSearch();
        }).catch(() => alert('请先点击建筑进入室内地图。'));
        return;
      }
    }
    executeSearch();

    function executeSearch() {
      // 如果起終點在室内但图中没有，尝试从建筑入口连接
      _ensureIndoorLoaded(fromId, () => _ensureIndoorLoaded(toId, _doSearch));
    }

    function _doSearch() {
      const result = AStar.findPath(graph, fromId, toId);
      if (!result) {
        alert('未找到可达路径，请确认起终点之间的路网连通。');
        return;
      }
      // 渲染路径
      pathRenderer.drawOutdoor(outdoorMap.map, result.path);

      // 如果有室内段，自动进入室内视图
      const segs = PathRenderer.segmentPath(result.path);
      const indoorSeg = segs.find(s => s.type === 'indoor');
      if (indoorSeg && layerSwitch.mode === 'outdoor') {
        const buildingId = indoorSeg.nodes[0]?.building;
        const building = buildings.find(b => b.id === buildingId);
        if (building) {
          DataLoader.loadIndoor(building.id).then(indoorData => {
            indoorGraphBuilder.build(building.id, indoorData);
            layerSwitch.enterIndoor(building, indoorData, indoorSeg.floor);
            indoorMap.render(result.path);
          });
        }
      }
      if (layerSwitch.mode === 'indoor') {
        indoorMap.render(result.path);
      }

      infoPanel.showRoute({ ...result, totalDistance: result.distance });
    }
  }

  function _ensureIndoorLoaded(nodeId, callback) {
    const node = graph.getNode(nodeId);
    if (node) { callback(); return; }
    // 根据 nodeId 前缀猜建筑
    const prefix = nodeId.split('-')[0];
    const building = buildings.find(b => b.id === prefix || nodeId.startsWith(b.id));
    if (!building) { callback(); return; }
    DataLoader.loadIndoor(building.id).then(data => {
      indoorGraphBuilder.build(building.id, data);
      callback();
    }).catch(() => callback());
  }

  console.log('[App] 南京大学智能校园地图初始化完成');
  console.log(`[App] 图规模: ${graph.size()} 个节点`);
})();

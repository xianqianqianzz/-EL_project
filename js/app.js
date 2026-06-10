(async function initApp() {
  // ===== Dark mode =====
  (function () {
    if (localStorage.getItem("nju-map-theme") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    var btn = document.getElementById("btn-theme");
    if (btn) {
      btn.onclick = function () {
        var isDark = document.documentElement.getAttribute("data-theme") === "dark";
        if (isDark) { document.documentElement.removeAttribute("data-theme"); localStorage.setItem("nju-map-theme", "light"); btn.textContent = "\u2600"; }
        else { document.documentElement.setAttribute("data-theme", "dark"); localStorage.setItem("nju-map-theme", "dark"); btn.textContent = "\ud83c\udf19"; }
      };
      btn.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "\ud83c\udf19" : "\u2600";
    }
  })();

  // ===== URL route params =====
  (function () {
    var p = new URLSearchParams(window.location.search);
    var f = p.get("from"), t = p.get("to");
    if (f) { var fi = document.getElementById("search-from"); if (fi) fi.value = f; }
    if (t) { var ti = document.getElementById("search-to"); if (ti) ti.value = t; }
  })();

  const emptyPanel = document.getElementById("panel-empty");
  if (typeof L === "undefined") { emptyPanel.textContent = "Leaflet 未加载，无法显示地图。"; return; }

  // ===== Shared state =====
  var areaIndex;
  try {
    areaIndex = await DataLoader.loadJSON(CONFIG.dataPaths.areasIndex);
  } catch (e) { console.error(e); emptyPanel.textContent = "加载区域索引失败：" + e.message; return; }

  var graph, map, searchBox, infoPanel, pathRenderer;
  var area, areaEntry, placeByNodeId, selectableNodes, itemByNodeId, searchItems;
  var indoorMap, layerSwitch, buildings = [];
  var measuring = false, measurePoints = [], measureLayer;
  var nearbyMode = false;
  var selectionRole = null;
  var currentAreaId = null;

  // ===== Measure tool setup =====
  var measureBtn = document.getElementById("btn-measure");

  function setupMeasureTool() {
    measuring = false; measurePoints = [];
    if (measureLayer) { measureLayer.clearLayers(); }
    if (measureBtn) {
      measureBtn.onclick = function () {
        measuring = !measuring;
        measureBtn.classList.toggle("measuring", measuring);
        if (measuring) { measurePoints = []; measureLayer.clearLayers(); map.map.getContainer().style.cursor = "crosshair"; }
        else { measurePoints = []; measureLayer.clearLayers(); map.map.getContainer().style.cursor = ""; infoPanel.showEmpty(); }
      };
    }
  }

  function onMeasureClick(e) {
    if (!measuring) return;
    var x = e.latlng.lng, y = -e.latlng.lat;
    measurePoints.push({ x: x, y: y });
    L.circleMarker(map.point(x, y), { radius: 5, color: "#d45b3e", fillColor: "#d45b3e", fillOpacity: .9 }).addTo(measureLayer);
    if (measurePoints.length === 2) {
      var a = measurePoints[0], b = measurePoints[1];
      var mpp = area.image ? area.image.metersPerPixel : 0.21;
      var dist = Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2) * mpp;
      var mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
      L.polyline([map.point(a.x,a.y), map.point(b.x,b.y)], { color: "#d45b3e", weight: 3, dashArray: "8 6", opacity: .9 }).addTo(measureLayer);
      L.marker(map.point(mx, my), { icon: L.divIcon({ className: "measure-label", html: Math.round(dist)+" m", iconSize: [60,20], iconAnchor: [30,10] }) }).addTo(measureLayer);
      measurePoints = [];
    }
  }

  // ===== Share route =====
  var shareBtn = document.getElementById("btn-share-route");
  if (shareBtn) {
    shareBtn.onclick = function () {
      var fi = document.getElementById("search-from"), ti = document.getElementById("search-to");
      if (!fi || !ti || !fi.value || !ti.value) return;
      var url = window.location.origin + window.location.pathname + "?from=" + encodeURIComponent(fi.value) + "&to=" + encodeURIComponent(ti.value);
      navigator.clipboard.writeText(url).then(function () {
        shareBtn.textContent = "\u2705 已复制"; shareBtn.classList.add("copied");
        setTimeout(function () { shareBtn.textContent = "\ud83d\udccb 复制分享链接"; shareBtn.classList.remove("copied"); }, 2000);
      }).catch(function () { prompt("复制以下链接：", url); });
    };
  }

  // ===== Nearby exploration =====
  function findNearby(startNodeId, maxMin) {
    var maxDist = maxMin * 60 * CONFIG.walkingSpeed;
    var dist = new Map(); dist.set(startNodeId, 0);
    var pq = [[startNodeId, 0]]; var visited = {};
    while (pq.length) {
      pq.sort(function (a, b) { return a[1] - b[1]; });
      var cur = pq.shift(), curId = cur[0], curD = cur[1];
      if (visited[curId]) continue; visited[curId] = true;
      for (var ei = 0; ei < area.edges.length; ei++) {
        var e = area.edges[ei], nb = null;
        if (e.from === curId) nb = e.to; else if (e.to === curId) nb = e.from;
        if (!nb || visited[nb]) continue;
        var fn = area.nodes.find(function (x) { return x.id === e.from; });
        var tn = area.nodes.find(function (x) { return x.id === e.to; });
        if (!fn || !tn) continue;
        var w = Math.sqrt((fn.x-tn.x)**2 + (fn.y-tn.y)**2) * area.image.metersPerPixel;
        var nd = curD + w; if (nd > maxDist) continue;
        if (!dist.has(nb) || nd < dist.get(nb)) { dist.set(nb, nd); pq.push([nb, nd]); }
      }
    }
    var r = { near: [], medium: [], far: [] };
    for (var pi = 0; pi < area.places.length; pi++) {
      var pl = area.places[pi]; if (pl.routeNodeId === startNodeId) continue;
      var d = dist.get(pl.routeNodeId); if (d === undefined) continue;
      var mins = d / CONFIG.walkingSpeed / 60;
      var entry = { label: pl.label, id: pl.id, distance: Math.round(d), minutes: Math.round(mins) };
      if (mins <= 5) r.near.push(entry); else if (mins <= 10) r.medium.push(entry); else r.far.push(entry);
    }
    var sf = function (a, b) { return a.distance - b.distance; };
    r.near.sort(sf); r.medium.sort(sf); r.far.sort(sf);
    return r;
  }

  function showNearbyFor(place) {
    var rp = document.getElementById("panel-route"), ep = document.getElementById("panel-empty");
    if (rp) rp.classList.add("hidden"); if (ep) ep.classList.remove("hidden");
    var nb = findNearby(place.routeNodeId, 15);
    var h = "<h3 style=\"margin-bottom:4px;color:var(--primary)\">\ud83d\udccd " + place.label + " 附近</h3>";
    h += "<p style=\"color:var(--text-light);font-size:12px;margin-bottom:10px\">沿真实路网步行范围，基于Dijkstra算法</p>";
    function g(title, items, color) {
      if (!items.length) return "";
      var s = "<div style=\"margin-bottom:8px\"><strong style=\"color:" + color + "\">" + title + "</strong><ul style=\"list-style:none;padding-left:4px;margin-top:2px\">";
      for (var i = 0; i < items.length; i++) s += "<li style=\"padding:2px 0;font-size:13px;border-bottom:1px solid var(--border)\">" + items[i].label + " <span style=\"color:var(--text-light);font-size:11px\">" + items[i].distance + "m \u2248" + items[i].minutes + "分</span></li>";
      return s + "</ul></div>";
    }
    h += g("\ud83d\udfe2 5分钟内", nb.near, "#4caf93");
    h += g("\ud83d\udfe1 10分钟内", nb.medium, "#e8a838");
    h += g("\ud83d\udd34 15分钟内", nb.far, "#d45038");
    h += "<button id=\"btn-close-nb\" style=\"margin-top:4px;padding:4px 10px;border:1px solid var(--border);border-radius:4px;background:var(--panel-bg);color:var(--text);cursor:pointer\">关闭</button>";
    if (ep) ep.innerHTML = h;
    var cb = document.getElementById("btn-close-nb"); if (cb) cb.onclick = function () { infoPanel.showEmpty(); };
  }

  // ===== Selection =====
  var sfBtn = document.getElementById("btn-select-from"), stBtn = document.getElementById("btn-select-to");
  var banner = document.getElementById("map-selection-banner"), bannerText = document.getElementById("map-selection-text");
  function startSelection(role) {
    selectionRole = role; sfBtn.classList.toggle("active", role==="from"); stBtn.classList.toggle("active", role==="to");
    bannerText.textContent = role==="from" ? "请选择起点节点" : "请选择终点节点";
    banner.classList.remove("hidden"); map.showSelectableNodes(selectableNodes, role, selectNode);
  }
  function stopSelection() { selectionRole = null; sfBtn.classList.remove("active"); stBtn.classList.remove("active"); banner.classList.add("hidden"); map.hideSelectableNodes(); }
  function selectNode(item) { if (!selectionRole) return; var r = selectionRole; stopSelection(); searchBox.setRole(r, item); }

  function doRouteSearch() {
    var fid = searchBox.fromNode ? (searchBox.fromNode.routeNodeId || searchBox.fromNode.id) : null;
    var tid = searchBox.toNode ? (searchBox.toNode.routeNodeId || searchBox.toNode.id) : null;
    if (!fid || !tid) { alert("请先选择起点和终点"); return; }
    var result = AStar.findPath(graph, fid, tid);
    if (!result) { alert("起终点之间无可达路径"); return; }
    pathRenderer.drawOutdoor(map.map, result.path);
    infoPanel.showRoute({ path: result.path, totalDistance: result.distance });
    var sb = document.getElementById("btn-share-route"); if (sb) sb.classList.remove("hidden");
  }

  // ===== Core: load a campus area =====
  async function loadArea(areaId) {
    // Clear previous state
    if (indoorMap) { indoorMap.destroy(); }
    if (layerSwitch) { layerSwitch.exitToOutdoor(); }
    if (map && map.map) { map.map.remove(); }
    infoPanel = new InfoPanel();
    
    var entry = (areaIndex.areas || []).find(function (x) { return x.id === areaId; });
    if (!entry) { emptyPanel.textContent = "未找到区域：" + areaId; return; }
    areaEntry = entry;
    currentAreaId = areaId;

    try {
      area = DataLoader.normalizeOutdoorArea(await DataLoader.loadJSON(entry.path));
      var problems = DataValidator.validateArea(area);
      if (problems.length) console.warn("[Area]", problems);
    } catch (e) { console.error(e); emptyPanel.textContent = "加载失败：" + e.message; return; }

    // Rebuild graph
    graph = new Graph();
    new OutdoorGraphBuilder(graph).build(area.nodes, area.edges, area.image.metersPerPixel);

    // Create map
    map = new OutdoorMap("outdoor-map", area, entry.path);
    measureLayer = L.layerGroup().addTo(map.map);
    setupMeasureTool();

    // Search
    searchBox = new SearchBox();
    pathRenderer = new PathRenderer();
    placeByNodeId = new Map(area.places.map(function (p) { return [p.routeNodeId, p]; }));

    selectableNodes = area.nodes.map(function (n, i) {
      var pl = placeByNodeId.get(n.id);
      return { id: n.id, routeNodeId: n.id, type: "node", label: pl ? pl.label : ("节点" + String(i+1).padStart(3,"0")), x: n.x, y: n.y, floor: 0 };
    });
    itemByNodeId = new Map(selectableNodes.map(function (x) { return [x.id, x]; }));
    searchItems = area.places.map(function (p) { return Object.assign({}, p, { keywords: [p.label], floor: 0 }); });

    for (var si = 0; si < selectableNodes.length; si++) { var gn = graph.getNode(selectableNodes[si].id); if (gn) gn.label = selectableNodes[si].label; }
    map.renderPlaces(area.places);
    searchBox.buildIndex(searchItems);

    // Indoor map
    indoorMap = new IndoorMap("indoor-map-inner");
    layerSwitch = new LayerSwitch(map, indoorMap);
    layerSwitch.loadBuildings(buildings);

    // Back-to-outdoor button
    var btnBackOutdoor = document.getElementById("btn-back-outdoor");
    if (btnBackOutdoor) {
      btnBackOutdoor.onclick = function () {
        layerSwitch.exitToOutdoor();
        infoPanel.showEmpty();
      };
    }

    layerSwitch.onSwitch(function (mode, building) {
      if (mode === "indoor" && building) {
        emptyPanel.classList.remove("hidden");
        document.getElementById("panel-route").classList.add("hidden");
        var desc = building.floors && building.floors[0] && building.floors[0].description;
        var hint = desc || "点击楼层按钮切换楼层，滚轮缩放，拖拽平移";
        if (typeof hint === "string" && hint.length > 200) hint = hint.substring(0, 200) + "...";
        emptyPanel.innerHTML = "<h3 style=\"margin-bottom:8px;color:var(--primary)\">" + building.name + "</h3>" +
          "<p class=\"hint\" style=\"margin-top:4px\">" + hint + "</p>";
      }
    });

    // Wire up event handlers
    searchBox.onChange(function () { if (searchBox.fromNode && searchBox.toNode) doRouteSearch(); });
    sfBtn.onclick = function () { startSelection("from"); };
    stBtn.onclick = function () { startSelection("to"); };
    document.getElementById("btn-cancel-selection").onclick = stopSelection;
    document.getElementById("btn-route").onclick = doRouteSearch;
    document.getElementById("btn-swap").onclick = function () { searchBox.swap(); if (searchBox.fromNode && searchBox.toNode) doRouteSearch(); };

    map.onPlaceClick(function (place) {
      if (layerSwitch.mode === "indoor") return;
      if (nearbyMode) { showNearbyFor(place); return; }
      if (!selectionRole) {
        var bldg = layerSwitch.findBuildingByName(place.label);
        if (bldg) {
          layerSwitch.enterIndoor(bldg);
          return;
        }
        showNearbyFor(place);
        return;
      }
      var item = searchItems.find(function (c) { return c.id === place.id; }) || itemByNodeId.get(place.routeNodeId);
      if (item) selectNode(item);
    });

    map.map.on("click", function (e) {
      if (measuring) { onMeasureClick(e); return; }
    });

    console.log("[App] " + area.name + " " + area.places.length + " places, " + area.nodes.length + " nodes, " + area.edges.length + " edges");
  }

  // ===== Campus switcher =====
  var campusSwitcher = document.getElementById("campus-switcher");
  if (campusSwitcher) {
    campusSwitcher.addEventListener("change", function () {
      var newAreaId = campusSwitcher.value;
      if (newAreaId === currentAreaId) return;
      // Reset state
      nearbyMode = false;
      var nearbyToggle = document.getElementById("btn-nearby");
      if (nearbyToggle) { nearbyToggle.classList.remove("active"); nearbyToggle.style.background = ""; nearbyToggle.style.color = ""; nearbyToggle.textContent = "附近"; }
      stopSelection();
      infoPanel.showEmpty();
      loadArea(newAreaId);
    });
  }

  // ===== Nearby toggle =====
  var nearbyToggle = document.createElement("button");
  nearbyToggle.textContent = "附近"; nearbyToggle.id = "btn-nearby";
  nearbyToggle.style.cssText = "padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--panel-bg);color:var(--text);cursor:pointer;font-size:13px;margin-left:8px";
  nearbyToggle.onclick = function () {
    nearbyMode = !nearbyMode;
    nearbyToggle.classList.toggle("active", nearbyMode);
    nearbyToggle.style.background = nearbyMode ? "var(--accent)" : ""; nearbyToggle.style.color = nearbyMode ? "#fff" : "";
    nearbyToggle.textContent = nearbyMode ? "探索中" : "附近";
    if (map) map.map.getContainer().style.cursor = nearbyMode ? "pointer" : "";
    if (!nearbyMode) infoPanel.showEmpty();
  };
  var sc = document.querySelector(".search-container"); if (sc) sc.appendChild(nearbyToggle);

  // ===== Load default campus =====
  try {
    buildings = await DataLoader.loadJSON("data/indoor/buildings.json");
  } catch (e) { console.warn("[Indoor] 建筑数据加载失败:", e.message); }
  
  var defaultAreaId = areaIndex.defaultOutdoorAreaId || "outdoor-xianlin";
  if (campusSwitcher) campusSwitcher.value = defaultAreaId;
  await loadArea(defaultAreaId);
  if (buildings.length) console.log("[App] " + buildings.length + " buildings loaded for indoor view");
})();
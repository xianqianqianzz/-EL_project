(function setupPathEditor() {
  const state = { mode: 'node', image: null, nodes: [], edges: [], selected: null, history: [], baseline: null, zoom: 1, drag: null, suppressClick: false };
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const wrap = document.getElementById('canvas-wrap');
  const api = path => `${CONFIG.apiBase}${path}`;
  const setStatus = text => { status.textContent = text; };
  const nextId = (prefix, items) => {
    let number = 1;
    while (items.some(item => item.id === `feedback-${prefix}-${number}`)) number++;
    return `feedback-${prefix}-${number}`;
  };
  const snapshot = () => state.history.push(JSON.stringify({ nodes: state.nodes, edges: state.edges, selected: state.selected }));
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.round((event.clientX - rect.left) * canvas.width / rect.width), y: Math.round((event.clientY - rect.top) * canvas.height / rect.height) };
  };
  const nodeNear = (value, distance = 24) => state.nodes.reduce((best, node) => Math.hypot(node.x - value.x, node.y - value.y) < (best?.distance ?? distance) ? { node, distance: Math.hypot(node.x - value.x, node.y - value.y) } : best, null)?.node;
  function edgeDistance(value, from, to) {
    const dx = to.x - from.x; const dy = to.y - from.y;
    const t = Math.max(0, Math.min(1, ((value.x - from.x) * dx + (value.y - from.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(value.x - from.x - t * dx, value.y - from.y - t * dy);
  }
  const edgeNear = value => state.edges.find(edge => {
    const from = state.nodes.find(node => node.id === edge.from); const to = state.nodes.find(node => node.id === edge.to);
    return from && to && edgeDistance(value, from, to) < 16;
  });
  function setMode(mode) {
    state.mode = mode; state.selected = null;
    ['node', 'edge', 'remove-node', 'remove-edge'].forEach(name => document.getElementById(`mode-${name}`).classList.toggle('active', name === mode));
    const messages = { node: '添加节点：在道路中心线或转折处点击。', edge: '连接节点：依次点击起点和终点节点。', 'remove-node': '删除错误节点：点击节点，工具会同时移除它连接的边。', 'remove-edge': '删除错误边：点击地图中不应通行的边。' };
    setStatus(messages[mode]);
    render();
  }
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); if (state.image) ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 5;
    state.edges.forEach(edge => { const a = state.nodes.find(n => n.id === edge.from); const b = state.nodes.find(n => n.id === edge.to); if (!a || !b) return; ctx.strokeStyle = state.baseline.edgeIds.has(edge.id) ? 'rgba(13,111,104,.58)' : '#dd6846'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
    state.nodes.forEach(node => { ctx.fillStyle = node.id === state.selected ? '#dd6846' : state.baseline.nodeIds.has(node.id) ? '#0d6f68' : '#17252b'; ctx.beginPath(); ctx.arc(node.x, node.y, node.id === state.selected ? 10 : 6, 0, Math.PI * 2); ctx.fill(); });
    document.getElementById('node-count').textContent = state.nodes.filter(node => !state.baseline.nodeIds.has(node.id)).length;
    document.getElementById('edge-count').textContent = state.edges.filter(edge => !state.baseline.edgeIds.has(edge.id)).length;
    document.getElementById('removed-node-count').textContent = [...state.baseline.nodeIds].filter(id => !state.nodes.some(node => node.id === id)).length;
    document.getElementById('removed-count').textContent = [...state.baseline.edgeIds].filter(id => !state.edges.some(edge => edge.id === id)).length;
  }
  function updateZoom(value, focus = null) {
    const oldZoom = state.zoom;
    const nextZoom = Math.max(.2, Math.min(2, value));
    const anchor = focus || { x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 };
    const contentX = (wrap.scrollLeft + anchor.x) / oldZoom;
    const contentY = (wrap.scrollTop + anchor.y) / oldZoom;
    state.zoom = nextZoom;
    canvas.style.width = `${canvas.width * state.zoom}px`; canvas.style.height = `${canvas.height * state.zoom}px`;
    wrap.scrollLeft = contentX * state.zoom - anchor.x;
    wrap.scrollTop = contentY * state.zoom - anchor.y;
    document.getElementById('zoom-value').textContent = `${Math.round(state.zoom * 100)}%`;
  }
  async function loadOfficial() {
    try {
      const index = await fetch(api('/api/v1/areas')).then(response => response.json());
      const entry = index.areas.find(area => area.id === index.defaultOutdoorAreaId);
      const area = await fetch(api(entry.dataUrl)).then(response => response.json());
      state.areaId = area.areaId; state.nodes = area.nodes.map(node => ({ ...node })); state.edges = area.edges.map(edge => ({ ...edge }));
      state.baseline = { nodeIds: new Set(state.nodes.map(node => node.id)), edgeIds: new Set(state.edges.map(edge => edge.id)) };
      const image = new Image(); image.onload = () => { state.image = image; canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; updateZoom(Math.min((wrap.clientWidth - 20) / canvas.width, (wrap.clientHeight - 20) / canvas.height)); render(); setStatus('正式地图已加载。请选择左侧操作开始标注。'); }; image.src = `${api(entry.mapUrl)}?v=${Date.now()}`;
    } catch (error) { setStatus(`地图加载失败：${error.message}`); }
  }
  canvas.addEventListener('click', event => {
    if (state.suppressClick) { state.suppressClick = false; return; }
    const value = point(event);
    if (state.mode === 'node') { snapshot(); state.nodes.push({ id: nextId('node', state.nodes), type: 'node', ...value }); setStatus('已添加节点。'); }
    if (state.mode === 'edge') {
      const node = nodeNear(value); if (!node) return setStatus('请点击已有节点。');
      if (!state.selected) { state.selected = node.id; setStatus('已选择起点，请点击终点。'); }
      else if (state.selected !== node.id && !state.edges.some(edge => [edge.from, edge.to].includes(state.selected) && [edge.from, edge.to].includes(node.id))) { snapshot(); state.edges.push({ id: nextId('edge', state.edges), type: 'edge', from: state.selected, to: node.id, walkable: true }); state.selected = null; setStatus('已连接两个节点。'); }
    }
    if (state.mode === 'remove-edge') { const edge = edgeNear(value); if (!edge) return setStatus('附近没有可删除的边。'); snapshot(); state.edges = state.edges.filter(item => item.id !== edge.id); setStatus('已标记删除该边。'); }
    if (state.mode === 'remove-node') {
      const node = nodeNear(value);
      if (!node) return setStatus('附近没有可删除的节点。');
      const incidentCount = state.edges.filter(edge => edge.from === node.id || edge.to === node.id).length;
      snapshot();
      state.edges = state.edges.filter(edge => edge.from !== node.id && edge.to !== node.id);
      state.nodes = state.nodes.filter(item => item.id !== node.id);
      state.selected = null;
      setStatus(`已标记删除节点，并同步移除 ${incidentCount} 条关联边。地点绑定和连通性将在提交时校验。`);
    }
    render();
  });
  async function submit() {
    const token = sessionStorage.getItem('nju-campus-map-access-token'); if (!token) return setStatus('请先返回校园地图登录，再提交申请。');
    const payload = { area_id: state.areaId, title: document.getElementById('proposal-title').value.trim(), description: document.getElementById('proposal-description').value.trim(), changes: {
      add_nodes: state.nodes.filter(node => !state.baseline.nodeIds.has(node.id)).map(({ id, x, y }) => ({ id, type: 'node', x, y })),
      add_edges: state.edges.filter(edge => !state.baseline.edgeIds.has(edge.id)).map(({ id, from, to }) => ({ id, type: 'edge', from, to, walkable: true })),
      remove_node_ids: [...state.baseline.nodeIds].filter(id => !state.nodes.some(node => node.id === id)),
      remove_edge_ids: [...state.baseline.edgeIds].filter(id => !state.edges.some(edge => edge.id === id))
    }};
    try { const response = await fetch(api('/api/v1/proposals'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.detail || `提交失败（${response.status}）`); setStatus(`申请 #${result.id} 已提交，工作人员审核后才会更新正式地图。`); } catch (error) { setStatus(error.message); }
  }
  ['node', 'edge', 'remove-node', 'remove-edge'].forEach(mode => document.getElementById(`mode-${mode}`).addEventListener('click', () => setMode(mode)));
  document.getElementById('undo').addEventListener('click', () => { const previous = state.history.pop(); if (!previous) return setStatus('没有可撤销的操作。'); Object.assign(state, JSON.parse(previous)); render(); });
  document.getElementById('clear-edge-selection').addEventListener('click', () => { state.selected = null; render(); setStatus('已取消当前连边。'); });
  document.getElementById('zoom-in').addEventListener('click', () => updateZoom(state.zoom + .15));
  document.getElementById('zoom-out').addEventListener('click', () => updateZoom(state.zoom - .15));
  document.getElementById('zoom-fit').addEventListener('click', () => updateZoom(Math.min((wrap.clientWidth - 20) / canvas.width, (wrap.clientHeight - 20) / canvas.height)));
  wrap.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = wrap.getBoundingClientRect();
    updateZoom(state.zoom + (event.deltaY < 0 ? .1 : -.1), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    state.drag = { x: event.clientX, y: event.clientY, left: wrap.scrollLeft, top: wrap.scrollTop, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (!state.drag) return;
    const dx = event.clientX - state.drag.x;
    const dy = event.clientY - state.drag.y;
    if (Math.hypot(dx, dy) > 4) state.drag.moved = true;
    if (state.drag.moved) {
      wrap.scrollLeft = state.drag.left - dx;
      wrap.scrollTop = state.drag.top - dy;
    }
  });
  function stopDrag(event) {
    if (!state.drag) return;
    state.suppressClick = state.drag.moved;
    state.drag = null;
    canvas.classList.remove('dragging');
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  document.getElementById('submit-proposal').addEventListener('click', submit);
  loadOfficial();
})();

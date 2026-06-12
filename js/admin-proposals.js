(async function initAdminProposals() {
  if (!await adminClient.init('proposals')) return;
  let proposals = [];
  const target = document.getElementById('proposal-list');
  const filter = document.getElementById('proposal-status');
  const search = document.getElementById('proposal-search');
  const dialog = document.getElementById('proposal-preview');
  const canvas = document.getElementById('proposal-preview-canvas');
  const ctx = canvas.getContext('2d');
  const statusText = { pending: '待审核', approved: '已批准', rejected: '已拒绝' };
  search.value = new URLSearchParams(window.location.search).get('q') || '';

  const removedNodes = item => item.changes.remove_node_ids || [];
  function render() {
    const keyword = search.value.trim().toLowerCase();
    const filtered = proposals.filter(item => (!filter.value || item.status === filter.value) &&
      (!keyword || `#${item.id} ${item.id} ${item.title} ${item.description}`.toLowerCase().includes(keyword)));
    target.innerHTML = filtered.length ? filtered.map(item => `<article class="proposal-row ${item.status}">
      <div><span class="record-number">申请 #${item.id}</span><h3>${adminClient.escape(item.title)}</h3><p>${adminClient.escape(item.description)}</p><p>新增 ${item.changes.add_nodes.length} 个节点、${item.changes.add_edges.length} 条边；删除 ${removedNodes(item).length} 个节点、${item.changes.remove_edge_ids.length} 条边</p>${item.review_note ? `<p>审核意见：${adminClient.escape(item.review_note)}</p>` : ''}</div>
      <div class="proposal-actions"><span class="admin-status ${item.status === 'pending' ? 'pending' : ''}">${statusText[item.status]}</span><button data-action="preview" data-id="${item.id}">地图预览</button>${item.status === 'pending' ? `<button data-action="approve" data-id="${item.id}">批准</button><button data-action="reject" data-id="${item.id}">拒绝</button>` : ''}</div>
    </article>`).join('') : '<p class="admin-empty">暂无符合条件的路径申请。</p>';
  }

  function drawLine(a, b, color, width, dashed = false) {
    if (!a || !b) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [18, 12] : []);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
  function drawNode(node, color, radius, cross = false) {
    if (!node) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 6;
    if (cross) {
      ctx.beginPath();
      ctx.moveTo(node.x - radius, node.y - radius); ctx.lineTo(node.x + radius, node.y + radius);
      ctx.moveTo(node.x + radius, node.y - radius); ctx.lineTo(node.x - radius, node.y + radius);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  async function showPreview(item) {
    document.getElementById('preview-title').textContent = `申请 #${item.id} · ${item.title}`;
    document.getElementById('preview-description').textContent = item.description;
    document.getElementById('preview-summary').textContent = '正在加载正式地图并生成对比预览...';
    dialog.showModal();
    try {
      const area = await adminClient.request(`/api/v1/areas/${item.area_id}`);
      const image = new Image();
      image.src = `${CONFIG.apiBase}/api/v1/areas/${item.area_id}/map?v=${Date.now()}`;
      await image.decode();
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.drawImage(image, 0, 0);
      const nodes = new Map(area.nodes.map(node => [node.id, node]));
      item.changes.add_nodes.forEach(node => nodes.set(node.id, node));
      const removedEdgeIds = new Set(item.changes.remove_edge_ids);
      area.edges.forEach(edge => drawLine(nodes.get(edge.from), nodes.get(edge.to), removedEdgeIds.has(edge.id) ? '#c73d32' : 'rgba(13,111,104,.34)', removedEdgeIds.has(edge.id) ? 14 : 5, removedEdgeIds.has(edge.id)));
      item.changes.add_edges.forEach(edge => drawLine(nodes.get(edge.from), nodes.get(edge.to), '#dd6846', 14));
      area.places.forEach(place => {
        const node = nodes.get(place.routeNodeId);
        if (!node) return;
        drawNode(node, '#62469b', 11);
        ctx.save(); ctx.fillStyle = '#301f4d'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(place.label, node.x + 16, node.y - 16); ctx.restore();
      });
      item.changes.add_nodes.forEach(node => drawNode(node, '#dd6846', 13));
      removedNodes(item).forEach(id => drawNode(nodes.get(id), '#c73d32', 18, true));
      document.getElementById('preview-summary').textContent = `橙色为新增，红色虚线和叉号为删除。新增 ${item.changes.add_nodes.length} 个节点、${item.changes.add_edges.length} 条边；删除 ${removedNodes(item).length} 个节点、${item.changes.remove_edge_ids.length} 条边。`;
    } catch (error) {
      document.getElementById('preview-summary').textContent = `预览加载失败：${error.message}`;
    }
  }

  async function refresh() {
    try {
      proposals = await adminClient.request('/api/v1/proposals');
      render();
    } catch (error) {
      target.innerHTML = `<p class="admin-error">${adminClient.escape(error.message)}</p>`;
    }
  }
  target.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const item = proposals.find(proposal => String(proposal.id) === button.dataset.id);
    if (button.dataset.action === 'preview') return showPreview(item);
    const note = prompt(button.dataset.action === 'approve' ? '填写批准与现场核验说明' : '填写拒绝原因');
    if (!note?.trim()) return;
    try {
      await adminClient.request(`/api/v1/proposals/${button.dataset.id}/${button.dataset.action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() })
      });
      await refresh();
    } catch (error) {
      alert(error.message);
    }
  });
  document.getElementById('preview-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  filter.addEventListener('change', render);
  search.addEventListener('input', render);
  refresh();
})();

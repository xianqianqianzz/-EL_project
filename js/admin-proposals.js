(async function initAdminProposals() {
  if (!await adminClient.init('proposals')) return;
  let proposals = [];
  const target = document.getElementById('proposal-list');
  const filter = document.getElementById('proposal-status');
  const statusText = { pending: '待审核', approved: '已批准', rejected: '已拒绝' };

  function render() {
    const filtered = proposals.filter(item => !filter.value || item.status === filter.value);
    target.innerHTML = filtered.length ? filtered.map(item => `<article class="proposal-row ${item.status}">
      <div><h3>${adminClient.escape(item.title)}</h3><p>${adminClient.escape(item.description)}</p><p>新增 ${item.changes.add_nodes.length} 个节点、${item.changes.add_edges.length} 条边；删除 ${item.changes.remove_edge_ids.length} 条边</p>${item.review_note ? `<p>审核意见：${adminClient.escape(item.review_note)}</p>` : ''}</div>
      <div class="proposal-actions"><span class="admin-status ${item.status === 'pending' ? 'pending' : ''}">${statusText[item.status]}</span>${item.status === 'pending' ? `<button data-action="approve" data-id="${item.id}">批准</button><button data-action="reject" data-id="${item.id}">拒绝</button>` : ''}</div>
    </article>`).join('') : '<p class="admin-empty">暂无符合条件的路径申请。</p>';
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
  filter.addEventListener('change', render);
  refresh();
})();

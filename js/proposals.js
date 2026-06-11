class ProposalsClient {
  constructor() {
    this.auth = window.authClient;
    this.drawer = document.getElementById('proposal-drawer');
    this.mineList = document.getElementById('my-proposal-list');
    this.reviewSection = document.getElementById('proposal-review-section');
    this.reviewList = document.getElementById('proposal-review-list');
    this.setupEvents();
    this.applyAuthState();
  }

  setupEvents() {
    window.addEventListener('auth:changed', event => {
      this.auth = event.detail.client;
      this.applyAuthState();
    });
    document.getElementById('btn-proposals').addEventListener('click', () => {
      this.drawer.classList.remove('hidden');
      this.refresh();
    });
    document.getElementById('btn-close-proposals').addEventListener('click', () => this.drawer.classList.add('hidden'));
    this.reviewList.addEventListener('click', event => this.handleReview(event));
  }

  applyAuthState() {
    const user = this.auth?.user;
    document.getElementById('btn-proposals').classList.toggle('hidden', !user);
    this.reviewSection.classList.toggle('hidden', !user || !['staff', 'admin'].includes(user.role));
    if (!user) this.drawer.classList.add('hidden');
  }

  async refresh() {
    if (!this.auth?.user) return;
    const mine = await this.auth.request('/api/v1/proposals/mine');
    this.mineList.innerHTML = mine.length
      ? mine.map(item => this.template(item, false)).join('')
      : '<p class="trip-empty">还没有提交过修改申请</p>';
    if (['staff', 'admin'].includes(this.auth.user.role)) {
      const queue = await this.auth.request('/api/v1/proposals');
      this.reviewList.innerHTML = queue.length
        ? queue.map(item => this.template(item, item.status === 'pending')).join('')
        : '<p class="trip-empty">暂无修改申请</p>';
    }
  }

  async handleReview(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const note = prompt(action === 'approve' ? '填写批准与核验说明' : '填写拒绝原因');
    if (!note?.trim()) return;
    try {
      await this.auth.request(`/api/v1/proposals/${button.dataset.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() })
      });
      await this.refresh();
    } catch (error) {
      alert(error.message);
    }
  }

  template(item, reviewable) {
    const status = { pending: '待审核', approved: '已批准', rejected: '已拒绝' }[item.status];
    const changes = item.changes;
    return `<article class="trip-item proposal-${item.status}">
      <div class="trip-item-heading"><strong>${this.escape(item.title)}</strong><span>${status}</span></div>
      <p>${this.escape(item.description)}</p>
      <p class="trip-meta">新增 ${changes.add_nodes.length} 节点 / ${changes.add_edges.length} 边 · 删除 ${changes.remove_edge_ids.length} 边</p>
      ${item.review_note ? `<p class="proposal-note">审核意见：${this.escape(item.review_note)}</p>` : ''}
      ${reviewable ? `<div class="trip-actions">
        <button data-action="approve" data-id="${item.id}">批准并合并</button>
        <button data-action="reject" data-id="${item.id}">拒绝</button>
      </div>` : ''}
    </article>`;
  }

  escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
  }
}

window.proposalsClient = new ProposalsClient();

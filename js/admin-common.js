class AdminClient {
  constructor() {
    this.session = window.sessionClient;
    this.user = null;
  }

  async init(activePage) {
    this.user = await this.session.restore();
    if (!this.user) {
      window.location.replace('../index.html?next=admin');
      return false;
    }
    if (!['staff', 'admin'].includes(this.user.role)) {
      document.body.innerHTML = '<main class="admin-error"><h1>无权访问管理后台</h1><p>此区域仅向工作人员与管理员开放。</p><p><a href="../map.html">返回校园地图</a></p></main>';
      return false;
    }
    document.getElementById('admin-user').textContent = `${this.user.display_name} · ${this.user.role === 'admin' ? '管理员' : '工作人员'}`;
    document.getElementById('admin-logout').addEventListener('click', () => this.session.logout());
    document.querySelectorAll('.admin-nav a').forEach(link => link.classList.toggle('active', link.dataset.page === activePage));
    return true;
  }

  request(path, options) { return this.session.request(path, options); }
  escape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]); }
  date(value) { return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)); }
}

window.adminClient = new AdminClient();

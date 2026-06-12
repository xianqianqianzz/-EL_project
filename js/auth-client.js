class SessionClient {
  constructor() {
    this.tokenKey = 'nju-campus-map-access-token';
    this.token = sessionStorage.getItem(this.tokenKey);
    this.user = null;
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const url = path.startsWith('http') ? path : `${CONFIG.apiBase}${path}`;
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || `请求失败（${response.status}）`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async restore() {
    if (!this.token) return null;
    try {
      this.user = await this.request('/api/v1/users/me');
      return this.user;
    } catch {
      this.logout(false);
      return null;
    }
  }

  async login(username, password) {
    const token = await this.request('/api/v1/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password })
    });
    this.token = token.access_token;
    sessionStorage.setItem(this.tokenKey, this.token);
    this.user = await this.request('/api/v1/users/me');
    await this.request('/api/v1/trips/demo', { method: 'POST' });
    return this.user;
  }

  async register(payload) {
    return this.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  logout(redirect = true) {
    this.token = null;
    this.user = null;
    sessionStorage.removeItem(this.tokenKey);
    if (redirect) window.location.href = 'map.html';
  }
}

window.sessionClient = new SessionClient();

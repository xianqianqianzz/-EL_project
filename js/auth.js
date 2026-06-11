class AuthClient {
  constructor() {
    this.tokenKey = 'nju-campus-map-access-token';
    this.token = sessionStorage.getItem(this.tokenKey);
    this.user = null;
    this.dialog = document.getElementById('auth-dialog');
    this.accountButton = document.getElementById('btn-account');
    this.accountMenu = document.getElementById('account-menu');
    this.status = document.getElementById('auth-status');
    this.loginForm = document.getElementById('login-form');
    this.registerForm = document.getElementById('register-form');
    this.setupEvents();
    this.restoreSession();
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const response = await fetch(path, { ...options, headers });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || `请求失败：${response.status}`);
    }
    return response.json();
  }

  async restoreSession() {
    if (!this.token) return this.render();
    try {
      this.user = await this.request('/api/v1/users/me');
    } catch {
      this.clearSession();
    }
    this.render();
  }

  clearSession() {
    this.token = null;
    this.user = null;
    sessionStorage.removeItem(this.tokenKey);
  }

  setStatus(message, isError = false) {
    this.status.textContent = message;
    this.status.classList.toggle('error', isError);
  }

  showMode(mode) {
    const loginMode = mode === 'login';
    this.loginForm.classList.toggle('hidden', !loginMode);
    this.registerForm.classList.toggle('hidden', loginMode);
    document.getElementById('tab-login').classList.toggle('active', loginMode);
    document.getElementById('tab-register').classList.toggle('active', !loginMode);
    this.setStatus('');
  }

  render() {
    this.accountButton.textContent = this.user ? this.user.display_name : '登录';
    document.getElementById('account-name').textContent = this.user?.display_name || '';
    document.getElementById('account-role').textContent = this.user
      ? `@${this.user.username} · ${this.user.role}`
      : '';
    this.accountMenu.classList.toggle('hidden', !this.user);
  }

  setupEvents() {
    this.accountButton.addEventListener('click', () => {
      if (this.user) {
        this.accountMenu.classList.toggle('hidden');
      } else {
        this.showMode('login');
        this.dialog.showModal();
      }
    });
    document.getElementById('tab-login').addEventListener('click', () => this.showMode('login'));
    document.getElementById('tab-register').addEventListener('click', () => this.showMode('register'));
    document.getElementById('btn-close-auth').addEventListener('click', () => this.dialog.close());
    document.getElementById('btn-logout').addEventListener('click', () => {
      this.clearSession();
      this.render();
    });

    this.loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(this.loginForm);
      try {
        const token = await this.request('/api/v1/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ username: form.get('username'), password: form.get('password') })
        });
        this.token = token.access_token;
        sessionStorage.setItem(this.tokenKey, this.token);
        this.user = await this.request('/api/v1/users/me');
        this.render();
        this.dialog.close();
        this.loginForm.reset();
      } catch (error) {
        this.setStatus(error.message, true);
      }
    });

    this.registerForm.addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(this.registerForm);
      if (form.get('password') !== form.get('password_confirm')) {
        this.setStatus('两次输入的密码不一致', true);
        return;
      }
      const payload = Object.fromEntries(form);
      delete payload.password_confirm;
      try {
        await this.request('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        this.loginForm.elements.username.value = form.get('username');
        this.showMode('login');
        this.setStatus('注册成功，请登录');
        this.registerForm.reset();
      } catch (error) {
        this.setStatus(error.message, true);
      }
    });
  }
}

new AuthClient();

(async function setupLoginPage() {
  const client = window.sessionClient;
  if (await client.restore()) {
    window.location.replace('map.html');
    return;
  }

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const status = document.getElementById('auth-status');
  const title = document.getElementById('account-title');

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function show(mode) {
    const login = mode === 'login';
    loginForm.classList.toggle('hidden', !login);
    registerForm.classList.toggle('hidden', login);
    document.getElementById('tab-login').classList.toggle('active', login);
    document.getElementById('tab-register').classList.toggle('active', !login);
    title.textContent = login ? '欢迎回来' : '加入校园助手';
    setStatus('');
  }

  document.getElementById('tab-login').addEventListener('click', () => show('login'));
  document.getElementById('tab-register').addEventListener('click', () => show('register'));

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(loginForm);
    setStatus('正在整理你的校园日程…');
    try {
      await client.login(form.get('username'), form.get('password'));
      window.location.replace('map.html');
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(registerForm);
    if (form.get('password') !== form.get('password_confirm')) {
      setStatus('两次输入的密码不一致', true);
      return;
    }
    const payload = Object.fromEntries(form);
    delete payload.password_confirm;
    try {
      await client.register(payload);
      await client.login(payload.username, payload.password);
      window.location.replace('map.html');
    } catch (error) {
      setStatus(error.message, true);
    }
  });
})();

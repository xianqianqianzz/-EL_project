(async function setupMapSession() {
  const client = window.sessionClient;
  const user = await client.restore();
  const authOnly = document.querySelectorAll('.auth-only');
  authOnly.forEach(element => element.classList.toggle('hidden', !user));
  document.getElementById('login-link').classList.toggle('hidden', Boolean(user));
  document.getElementById('logout-button').classList.toggle('hidden', !user);
  document.getElementById('guest-schedule-cta').classList.toggle('hidden', Boolean(user));
  const greeting = document.getElementById('header-greeting');
  greeting.textContent = user ? `${user.display_name}，欢迎回来` : '';
  greeting.classList.toggle('hidden', !user);
  document.getElementById('logout-button').addEventListener('click', () => client.logout());
})();

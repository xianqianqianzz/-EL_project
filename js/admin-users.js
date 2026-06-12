(async function initAdminUsers() {
  if (!await adminClient.init('users')) return;
  let users = [];
  const target = document.getElementById('users-table');
  const search = document.getElementById('user-search');
  const role = document.getElementById('user-role');
  const roleText = { user: '普通用户', staff: '工作人员', admin: '管理员' };

  function render() {
    const keyword = search.value.trim().toLowerCase();
    const filtered = users.filter(user =>
      (!role.value || user.role === role.value) &&
      (!keyword || `${user.username} ${user.display_name} ${user.masked_email}`.toLowerCase().includes(keyword))
    );
    target.innerHTML = filtered.length ? `<table class="admin-table"><thead><tr><th>用户</th><th>账号状态</th><th>角色</th><th>日程信息</th><th>注册日期</th></tr></thead><tbody>${filtered.map(user => `<tr>
      <td><strong>${adminClient.escape(user.display_name)}</strong><small>@${adminClient.escape(user.username)} · ${adminClient.escape(user.masked_email)}</small></td>
      <td><span class="admin-status ${user.status === '正常' ? '' : 'inactive'}">${user.status}</span></td>
      <td>${roleText[user.role] || user.role}</td>
      <td><strong>${user.trip_count} 条</strong><small>今日 ${user.today_trip_count} 条生效</small></td>
      <td>${adminClient.date(user.created_at)}</td>
    </tr>`).join('')}</tbody></table>` : '<p class="admin-empty">没有符合条件的用户。</p>';
  }

  try {
    users = await adminClient.request('/api/v1/admin/users');
    render();
  } catch (error) {
    target.innerHTML = `<p class="admin-error">${adminClient.escape(error.message)}</p>`;
  }
  search.addEventListener('input', render);
  role.addEventListener('change', render);
})();

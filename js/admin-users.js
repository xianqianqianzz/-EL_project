(async function initAdminUsers() {
  if (!await adminClient.init('users')) return;
  let users = [];
  let trips = [];
  let selectedId = null;
  const groupsTarget = document.getElementById('user-groups');
  const detailTarget = document.getElementById('user-detail');
  const search = document.getElementById('user-search');
  const role = document.getElementById('user-role');
  const roleText = { user: '普通用户', staff: '工作人员', admin: '管理员' };
  const recurrenceText = { once: '一次性', daily: '每天', weekly: '每周', monthly: '每月' };

  function filteredUsers() {
    const keyword = search.value.trim().toLowerCase();
    return users.filter(user => (!role.value || user.role === role.value) &&
      (!keyword || `${user.username} ${user.display_name} ${user.masked_email}`.toLowerCase().includes(keyword)));
  }

  function renderDirectory() {
    const filtered = filteredUsers();
    const grouped = ['admin', 'staff', 'user'].map(groupRole => ({
      role: groupRole, users: filtered.filter(user => user.role === groupRole)
    })).filter(group => group.users.length);
    groupsTarget.innerHTML = grouped.length ? grouped.map(group => `<div class="user-group"><h2>${roleText[group.role]}<span>${group.users.length}</span></h2>${group.users.map(user => `<button class="user-row ${String(user.id) === String(selectedId) ? 'active' : ''}" data-user-id="${user.id}" type="button"><span class="user-avatar">${adminClient.escape(user.display_name.slice(0, 1).toUpperCase())}</span><span><strong>${adminClient.escape(user.display_name)}</strong><small>@${adminClient.escape(user.username)} · ${user.trip_count} 条日程</small></span><i class="admin-status ${user.status === '正常' ? '' : 'inactive'}">${user.status}</i></button>`).join('')}</div>`).join('') : '<p class="admin-empty">没有符合条件的用户。</p>';
  }

  function renderDetail(user) {
    const items = trips.filter(trip => trip.user_id === user.id);
    detailTarget.innerHTML = `<div class="user-detail-heading"><div class="user-avatar large">${adminClient.escape(user.display_name.slice(0, 1).toUpperCase())}</div><div><span class="admin-eyebrow">${roleText[user.role]}</span><h2>${adminClient.escape(user.display_name)}</h2><p>@${adminClient.escape(user.username)} · ${adminClient.escape(user.masked_email)}</p></div><span class="admin-status ${user.status === '正常' ? '' : 'inactive'}">${user.status}</span></div>
      <dl class="user-facts"><div><dt>保存日程</dt><dd>${user.trip_count}</dd></div><div><dt>今日日程</dt><dd>${user.today_trip_count}</dd></div><div><dt>注册日期</dt><dd>${adminClient.date(user.created_at)}</dd></div></dl>
      <div class="admin-section-heading"><h2>该用户的日程</h2><span>${items.length} 条</span></div>
      <div class="user-trip-list">${items.length ? items.map(item => `<article><div><strong>${adminClient.escape(item.title)}</strong><p>${adminClient.escape(item.from_label)} → ${adminClient.escape(item.to_label)}</p></div><div><span class="admin-status">${recurrenceText[item.recurrence]}</span><small>最晚 ${item.latest_arrival_time.slice(0, 5)} 到达</small></div></article>`).join('') : '<p class="admin-empty">该用户还没有日程。</p>'}</div>`;
  }

  groupsTarget.addEventListener('click', event => {
    const button = event.target.closest('[data-user-id]');
    if (!button) return;
    selectedId = Number(button.dataset.userId);
    renderDirectory();
    renderDetail(users.find(user => user.id === selectedId));
  });
  search.addEventListener('input', renderDirectory);
  role.addEventListener('change', renderDirectory);

  try {
    [users, trips] = await Promise.all([
      adminClient.request('/api/v1/admin/users'),
      adminClient.request('/api/v1/admin/trips')
    ]);
    renderDirectory();
    if (users.length) {
      selectedId = users[0].id;
      renderDirectory();
      renderDetail(users[0]);
    }
  } catch (error) {
    groupsTarget.innerHTML = `<p class="admin-error">${adminClient.escape(error.message)}</p>`;
  }
})();

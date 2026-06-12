(async function initAdminTrips() {
  if (!await adminClient.init('trips')) return;
  let trips = [];
  const target = document.getElementById('trips-table');
  const search = document.getElementById('trip-search');
  const recurrence = document.getElementById('trip-recurrence');
  const recurrenceText = { once: '一次性', daily: '每天', weekly: '每周', monthly: '每月' };
  search.value = new URLSearchParams(window.location.search).get('q') || '';

  function render() {
    const keyword = search.value.trim().toLowerCase();
    const filtered = trips.filter(trip =>
      (!recurrence.value || trip.recurrence === recurrence.value) &&
      (!keyword || `#${trip.id} ${trip.id} ${trip.username} ${trip.display_name} ${trip.title} ${trip.from_label} ${trip.to_label}`.toLowerCase().includes(keyword))
    );
    target.innerHTML = filtered.length ? `<table class="admin-table"><thead><tr><th>编号</th><th>用户</th><th>日程</th><th>路线</th><th>规则</th><th>提醒</th></tr></thead><tbody>${filtered.map(trip => `<tr>
      <td><span class="record-number">日程 #${trip.id}</span></td>
      <td><strong>${adminClient.escape(trip.display_name)}</strong><small>@${adminClient.escape(trip.username)}</small></td>
      <td><strong>${adminClient.escape(trip.title)}</strong><small>${trip.start_date} 起</small></td>
      <td><strong>${adminClient.escape(trip.from_label)} → ${adminClient.escape(trip.to_label)}</strong><small>最晚 ${trip.latest_arrival_time.slice(0, 5)} 到达</small></td>
      <td><span class="admin-status">${recurrenceText[trip.recurrence]}</span></td>
      <td>提前 ${trip.reminder_minutes} 分钟</td>
    </tr>`).join('')}</tbody></table>` : '<p class="admin-empty">没有符合条件的日程。</p>';
  }

  try {
    trips = await adminClient.request('/api/v1/admin/trips');
    render();
  } catch (error) {
    target.innerHTML = `<p class="admin-error">${adminClient.escape(error.message)}</p>`;
  }
  search.addEventListener('input', render);
  recurrence.addEventListener('change', render);
})();

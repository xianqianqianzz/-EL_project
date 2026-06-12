(async function initAdminOverview() {
  if (!await adminClient.init('overview')) return;
  const metrics = document.getElementById('metrics');
  const attention = document.getElementById('attention');

  async function refresh() {
    try {
      const data = await adminClient.request('/api/v1/admin/summary');
      metrics.innerHTML = [
        ['全部账号', data.user_count],
        ['正常账号', data.active_user_count],
        ['保存日程', data.trip_count],
        ['今日日程', data.today_trip_count],
        ['待审路径', data.pending_proposal_count]
      ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
      attention.innerHTML = `<table class="admin-table"><thead><tr><th>关注事项</th><th>当前状态</th><th>建议动作</th></tr></thead><tbody>
        <tr><td><strong>路径修改申请</strong><small>来自用户的地图纠错与新路径</small></td><td><span class="admin-status ${data.pending_proposal_count ? 'pending' : ''}">${data.pending_proposal_count} 条待审核</span></td><td><a href="proposals.html">进入申请页面</a></td></tr>
        <tr><td><strong>今日日程使用</strong><small>今日生效的固定与一次性行程</small></td><td><span class="admin-status">${data.today_trip_count} 条生效</span></td><td><a href="trips.html">查看日程信息</a></td></tr>
        <tr><td><strong>账号运行状态</strong><small>账号信息已脱敏处理</small></td><td><span class="admin-status">${data.active_user_count} 个正常</span></td><td><a href="users.html">查看用户状态</a></td></tr>
      </tbody></table>`;
    } catch (error) {
      attention.innerHTML = `<p class="admin-error">${adminClient.escape(error.message)}</p>`;
    }
  }
  document.getElementById('refresh').addEventListener('click', refresh);
  refresh();
})();

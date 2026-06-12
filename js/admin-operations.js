(async function initOperations() {
  if (!await adminClient.init('operations')) return;
  const metrics = document.getElementById('operation-metrics');
  const backups = document.getElementById('backup-list');
  const createButton = document.getElementById('create-backup');

  function formatBytes(value) {
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  async function refresh() {
    try {
      const [status, items] = await Promise.all([
        adminClient.request('/api/v1/admin/operations'),
        adminClient.request('/api/v1/admin/backups')
      ]);
      metrics.innerHTML = [
        ['运行环境', status.environment],
        ['服务状态', status.service_status],
        ['数据库', status.database_status],
        ['地图数据', status.map_data_status],
        ['备份数量', status.backup_count]
      ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong class="metric-text">${adminClient.escape(value)}</strong></div>`).join('');
      backups.innerHTML = items.length ? `<table class="admin-table"><thead><tr><th>备份文件</th><th>创建时间</th><th>文件大小</th></tr></thead><tbody>${items.map(item => `<tr><td><strong>${adminClient.escape(item.name)}</strong></td><td>${adminClient.date(item.created_at)}</td><td>${formatBytes(item.size_bytes)}</td></tr>`).join('')}</tbody></table>` : '<p class="admin-empty">还没有备份。管理员可以创建第一份备份。</p>';
      createButton.hidden = adminClient.user.role !== 'admin';
    } catch (error) {
      backups.innerHTML = `<p class="admin-error">${adminClient.escape(error.message)}</p>`;
    }
  }

  createButton.addEventListener('click', async () => {
    createButton.disabled = true;
    createButton.textContent = '正在备份';
    try {
      await adminClient.request('/api/v1/admin/backups', { method: 'POST' });
      await refresh();
    } catch (error) {
      backups.innerHTML = `<p class="admin-error">${adminClient.escape(error.message)}</p>`;
    } finally {
      createButton.disabled = false;
      createButton.textContent = '创建备份';
    }
  });
  document.getElementById('refresh').addEventListener('click', refresh);
  refresh();
})();

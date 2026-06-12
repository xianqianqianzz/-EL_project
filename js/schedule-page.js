class SchedulePage {
  constructor() {
    this.client = window.sessionClient;
    this.dialog = document.getElementById('trip-dialog');
    this.form = document.getElementById('trip-form');
    this.trips = new Map();
    this.places = [];
    this.editingId = null;
  }

  async init() {
    const user = await this.client.restore();
    if (!user) {
      window.location.replace('index.html?next=schedule');
      return;
    }
    document.getElementById('header-greeting').textContent = `${user.display_name}，今天也要从容出发`;
    document.getElementById('nav-admin').classList.toggle('hidden', !['staff', 'admin'].includes(user.role));
    document.getElementById('logout-button').addEventListener('click', () => this.client.logout());
    this.renderDate();
    await this.loadPlaces();
    this.bindEvents();
    await this.refresh();
  }

  renderDate() {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', month: 'long', day: '2-digit', weekday: 'long'
    }).formatToParts(new Date());
    const value = type => parts.find(part => part.type === type)?.value || '';
    document.getElementById('date-month').textContent = value('month');
    document.getElementById('date-day').textContent = value('day');
    document.getElementById('date-weekday').textContent = value('weekday');
  }

  async loadPlaces() {
    const index = await DataLoader.loadFirstJSON(CONFIG.dataPaths.areasIndex);
    const entry = index.areas.find(area => area.id === index.defaultOutdoorAreaId);
    const area = await DataLoader.loadJSON(entry.dataUrl || entry.path);
    this.areaId = area.areaId;
    this.places = area.places;
    this.populatePlaces();
  }

  populatePlaces() {
    for (const select of [this.form.elements.from_place_id, this.form.elements.to_place_id]) {
      select.innerHTML = this.places.map(place =>
        `<option value="${this.escape(place.id)}">${this.escape(place.label)}</option>`
      ).join('');
    }
  }

  bindEvents() {
    document.getElementById('add-trip-button').addEventListener('click', () => this.openCreate());
    document.getElementById('close-trip-dialog').addEventListener('click', () => this.dialog.close());
    document.getElementById('cancel-trip-dialog').addEventListener('click', () => this.dialog.close());
    document.getElementById('trip-recurrence').addEventListener('change', event => {
      this.form.elements.end_date.disabled = event.target.value === 'once';
      if (this.form.elements.end_date.disabled) this.form.elements.end_date.value = '';
    });
    this.form.addEventListener('submit', event => this.save(event));
    document.body.addEventListener('click', event => this.handleAction(event));
    document.querySelector('[data-scroll-target]').addEventListener('click', event => {
      document.getElementById(event.currentTarget.dataset.scrollTarget).scrollIntoView({ behavior: 'smooth' });
    });
  }

  async refresh() {
    const [today, all] = await Promise.all([
      this.client.request('/api/v1/trips/today'),
      this.client.request('/api/v1/trips')
    ]);
    this.trips = new Map(all.map(trip => [String(trip.id), trip]));
    this.renderToday(today);
    this.renderAll(all);
  }

  renderToday(items) {
    const list = document.getElementById('today-trip-list');
    list.innerHTML = items.length ? items.map(item => this.todayTemplate(item)).join('') :
      '<p class="empty-message">今天没有安排，留一点时间给校园散步吧。</p>';
    document.getElementById('today-count').textContent = `${items.length} 项`;
    document.getElementById('walking-total').textContent =
      `${items.reduce((sum, item) => sum + item.estimated_duration_minutes, 0)} 分钟`;
    document.getElementById('next-departure').textContent = items[0]
      ? this.formatTime(items[0].suggested_departure_at) : '--:--';
    document.getElementById('today-summary').textContent = items.length
      ? `今天共有 ${items.length} 段校园行程，已按建议出发时间为你排列。`
      : '今天暂无安排，可以自在探索校园。';
  }

  renderAll(items) {
    document.getElementById('all-trip-list').innerHTML = items.length
      ? items.map(item => this.savedTemplate(item)).join('')
      : '<p class="empty-message">还没有保存的日程。</p>';
  }

  todayTemplate(item) {
    const status = { upcoming: '待出发', leave_soon: '临近出发', leave_now: '建议现在出发', late: '已超过到达时间' }[item.status];
    return `<article class="timeline-item trip-${item.status}">
      <time class="timeline-time">${this.formatTime(item.latest_arrival_at)}</time>
      <span class="timeline-dot"></span>
      <div><h3>${this.escape(item.title)}</h3><p>${this.escape(item.from_label)} → ${this.escape(item.to_label)}</p><span class="status-pill">${status}</span></div>
      <div class="timeline-route"><strong>建议 ${this.formatTime(item.suggested_departure_at)} 出发</strong><span>预计步行 ${item.estimated_duration_minutes} 分钟 · ${item.estimated_distance_meters} 米</span></div>
    </article>`;
  }

  savedTemplate(item) {
    const recurrence = { once: '一次性', daily: '每天', weekly: '每周', monthly: '每月' }[item.recurrence];
    return `<article class="saved-trip">
      <h3>${this.escape(item.title)}</h3>
      <p>${this.escape(item.from_label)} → ${this.escape(item.to_label)}</p>
      <p>${recurrence} · 最晚 ${item.latest_arrival_time.slice(0, 5)} 到达</p>
      <div class="trip-actions">
        <button data-action="route" data-from="${item.from_place_id}" data-to="${item.to_place_id}">在地图查看</button>
        <button data-action="edit" data-id="${item.id}">编辑</button>
        <button data-action="delete" data-id="${item.id}">删除</button>
      </div>
    </article>`;
  }

  openCreate() {
    this.editingId = null;
    this.form.reset();
    this.form.elements.start_date.value = this.localDate(new Date());
    this.form.elements.latest_arrival_time.value = this.localTime(new Date(Date.now() + 60 * 60 * 1000));
    this.form.elements.end_date.disabled = true;
    document.getElementById('trip-dialog-title').textContent = '添加日程';
    this.dialog.showModal();
  }

  openEdit(trip) {
    this.editingId = trip.id;
    this.form.reset();
    for (const [name, value] of Object.entries(trip)) {
      if (this.form.elements[name] && value !== null) {
        this.form.elements[name].value = name === 'latest_arrival_time' ? value.slice(0, 5) : value;
      }
    }
    this.form.elements.end_date.disabled = trip.recurrence === 'once';
    document.getElementById('trip-dialog-title').textContent = '编辑日程';
    this.dialog.showModal();
  }

  async save(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(this.form));
    payload.area_id = this.areaId;
    payload.reminder_minutes = Number(payload.reminder_minutes);
    if (!payload.end_date) delete payload.end_date;
    try {
      await this.client.request(this.editingId ? `/api/v1/trips/${this.editingId}` : '/api/v1/trips', {
        method: this.editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      this.dialog.close();
      await this.refresh();
    } catch (error) {
      document.getElementById('trip-status').textContent = error.message;
    }
  }

  async handleAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'route') {
      sessionStorage.setItem('nju-campus-route-request', JSON.stringify({ from: button.dataset.from, to: button.dataset.to }));
      window.location.href = 'map.html';
    } else if (button.dataset.action === 'edit') {
      this.openEdit(this.trips.get(button.dataset.id));
    } else if (button.dataset.action === 'delete' && confirm('确定删除这条日程吗？')) {
      await this.client.request(`/api/v1/trips/${button.dataset.id}`, { method: 'DELETE' });
      await this.refresh();
    }
  }

  formatTime(value) {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  }
  localDate(value) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(value); }
  localTime(value) { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(value); }
  escape(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]); }
}

new SchedulePage().init();

class TripsClient {
  constructor() {
    this.auth = window.authClient;
    this.mapContext = window.MAP_CONTEXT || null;
    this.drawer = document.getElementById('trip-drawer');
    this.dialog = document.getElementById('trip-dialog');
    this.form = document.getElementById('trip-form');
    this.todayList = document.getElementById('today-trip-list');
    this.allList = document.getElementById('all-trip-list');
    this.status = document.getElementById('trip-status');
    this.addButton = document.getElementById('btn-add-trip');
    this.tripsById = new Map();
    this.editingTripId = null;
    this.setupEvents();
    if (this.mapContext) {
      this.populatePlaces();
      this.addButton.disabled = false;
    }
    this.applyAuthState();
    this.refreshTimer = setInterval(() => this.refreshToday(), 30000);
  }

  setupEvents() {
    window.addEventListener('auth:changed', event => {
      this.auth = event.detail.client;
      this.applyAuthState();
    });
    window.addEventListener('map:ready', event => {
      this.mapContext = event.detail;
      this.populatePlaces();
      this.addButton.disabled = false;
    });
    document.getElementById('btn-trips').addEventListener('click', () => {
      this.drawer.classList.remove('hidden');
      this.refresh();
    });
    document.getElementById('btn-close-trips').addEventListener('click', () => this.drawer.classList.add('hidden'));
    this.addButton.addEventListener('click', () => this.openCreateDialog());
    document.getElementById('btn-close-trip-dialog').addEventListener('click', () => this.dialog.close());
    document.getElementById('trip-recurrence').addEventListener('change', event => {
      const endDate = this.form.elements.end_date;
      endDate.disabled = event.target.value === 'once';
      if (endDate.disabled) endDate.value = '';
    });
    this.form.addEventListener('submit', event => this.createTrip(event));
    this.drawer.addEventListener('click', event => this.handleDrawerAction(event));
  }

  applyAuthState() {
    const loggedIn = Boolean(this.auth?.user);
    const tripButton = document.getElementById('btn-trips');
    tripButton.classList.toggle('hidden', !loggedIn);
    if (loggedIn) this.refresh();
    if (!loggedIn) {
      tripButton.classList.remove('trip-alert');
      tripButton.textContent = '行程';
      this.drawer.classList.add('hidden');
      this.todayList.innerHTML = '';
      this.allList.innerHTML = '';
    }
  }

  populatePlaces() {
    if (!this.mapContext) return;
    for (const select of [this.form.elements.from_place_id, this.form.elements.to_place_id]) {
      select.innerHTML = '';
      for (const place of this.mapContext.places) {
        const option = document.createElement('option');
        option.value = place.id;
        option.textContent = place.label;
        select.appendChild(option);
      }
    }
  }

  openCreateDialog() {
    this.editingTripId = null;
    this.form.reset();
    this.form.elements.start_date.value = this.localDateString(new Date());
    this.form.elements.latest_arrival_time.value = this.localTimeString(new Date(Date.now() + 60 * 60 * 1000));
    this.form.elements.end_date.disabled = true;
    this.populatePlaces();
    document.getElementById('trip-dialog-title').textContent = '添加行程';
    document.getElementById('btn-save-trip').textContent = '保存行程';
    this.setStatus('');
    this.dialog.showModal();
  }

  openEditDialog(trip) {
    this.editingTripId = trip.id;
    this.form.reset();
    this.populatePlaces();
    for (const [name, value] of Object.entries(trip)) {
      if (!this.form.elements[name] || value === null) continue;
      this.form.elements[name].value = name === 'latest_arrival_time' ? value.slice(0, 5) : value;
    }
    this.form.elements.end_date.disabled = trip.recurrence === 'once';
    document.getElementById('trip-dialog-title').textContent = '编辑行程';
    document.getElementById('btn-save-trip').textContent = '保存修改';
    this.setStatus('');
    this.dialog.showModal();
  }

  async createTrip(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(this.form));
    data.area_id = this.mapContext?.areaId;
    data.reminder_minutes = Number(data.reminder_minutes);
    if (!data.end_date) delete data.end_date;
    try {
      const path = this.editingTripId ? `/api/v1/trips/${this.editingTripId}` : '/api/v1/trips';
      await this.auth.request(path, {
        method: this.editingTripId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      this.dialog.close();
      await this.refresh();
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  async refresh() {
    if (!this.auth?.user) return;
    await Promise.all([this.refreshToday(), this.refreshAll()]);
  }

  async refreshToday() {
    if (!this.auth?.user) return;
    try {
      const occurrences = await this.auth.request('/api/v1/trips/today');
      const urgent = occurrences.some(item => item.status === 'leave_soon' || item.status === 'leave_now');
      const tripButton = document.getElementById('btn-trips');
      tripButton.classList.toggle('trip-alert', urgent);
      tripButton.textContent = urgent ? '行程提醒' : '行程';
      this.todayList.innerHTML = occurrences.length
        ? occurrences.map(item => this.occurrenceTemplate(item)).join('')
        : '<p class="trip-empty">今天没有行程</p>';
    } catch (error) {
      this.todayList.innerHTML = `<p class="trip-error">${this.escape(error.message)}</p>`;
    }
  }

  async refreshAll() {
    try {
      const trips = await this.auth.request('/api/v1/trips');
      this.tripsById = new Map(trips.map(trip => [String(trip.id), trip]));
      this.allList.innerHTML = trips.length
        ? trips.map(item => this.tripTemplate(item)).join('')
        : '<p class="trip-empty">还没有固定行程</p>';
    } catch (error) {
      this.allList.innerHTML = `<p class="trip-error">${this.escape(error.message)}</p>`;
    }
  }

  async handleDrawerAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'route') {
      window.dispatchEvent(new CustomEvent('trip:show-route', {
        detail: {
          fromPlaceId: button.dataset.from,
          toPlaceId: button.dataset.to
        }
      }));
      return;
    }
    if (button.dataset.action === 'edit') {
      const trip = this.tripsById.get(button.dataset.id);
      if (trip) this.openEditDialog(trip);
      return;
    }
    if (button.dataset.action === 'delete' && confirm('确定删除这条行程吗？')) {
      await this.auth.request(`/api/v1/trips/${button.dataset.id}`, { method: 'DELETE' });
      await this.refresh();
    }
  }

  occurrenceTemplate(item) {
    const statusText = {
      upcoming: '待出发',
      leave_soon: '临近出发',
      leave_now: '应立即出发',
      late: '已超过最晚到达时间'
    }[item.status];
    return `<article class="trip-item trip-${item.status}">
      <div class="trip-item-heading">
        <strong>${this.escape(item.title)}</strong>
        <span>${statusText}</span>
      </div>
      <p>${this.escape(item.from_label)} → ${this.escape(item.to_label)}</p>
      <dl>
        <div><dt>建议出发</dt><dd>${this.formatDateTime(item.suggested_departure_at)}</dd></div>
        <div><dt>最晚到达</dt><dd>${this.formatDateTime(item.latest_arrival_at)}</dd></div>
        <div><dt>预计通行</dt><dd>${item.estimated_duration_minutes} 分钟 · ${item.estimated_distance_meters} 米</dd></div>
      </dl>
      <button data-action="route" data-from="${item.from_place_id}" data-to="${item.to_place_id}">查看路线</button>
    </article>`;
  }

  tripTemplate(item) {
    const recurrence = { once: '一次性', daily: '每天', weekly: '每周', monthly: '每月' }[item.recurrence];
    return `<article class="trip-item trip-saved">
      <div class="trip-item-heading"><strong>${this.escape(item.title)}</strong><span>${recurrence}</span></div>
      <p>${this.escape(item.from_label)} → ${this.escape(item.to_label)}</p>
      <p class="trip-meta">${item.start_date} 起 · 最晚 ${item.latest_arrival_time.slice(0, 5)} 到达</p>
      <div class="trip-actions">
        <button data-action="route" data-from="${item.from_place_id}" data-to="${item.to_place_id}">查看路线</button>
        <button data-action="edit" data-id="${item.id}">编辑</button>
        <button data-action="delete" data-id="${item.id}">删除</button>
      </div>
    </article>`;
  }

  setStatus(message, error = false) {
    this.status.textContent = message;
    this.status.classList.toggle('error', error);
  }

  localDateString(value) {
    const parts = this.dateParts(value);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  localTimeString(value) {
    const parts = this.dateParts(value);
    return `${parts.hour}:${parts.minute}`;
  }

  formatDateTime(value) {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(value));
  }

  dateParts(value) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(value).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  }

  escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
  }
}

window.tripsClient = new TripsClient();

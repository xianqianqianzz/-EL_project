/**
 * 搜索模块
 * 提供地点搜索、自动补全、起终点选择功能
 */
class SearchBox {
  constructor() {
    this.fromInput = document.getElementById('search-from');
    this.toInput = document.getElementById('search-to');
    this.fromSuggest = document.getElementById('suggestions-from');
    this.toSuggest = document.getElementById('suggestions-to');

    /** @type {SearchItem[]} 所有可搜索条目（室外目标+室内目标） */
    this.index = [];

    this.fromNode = null;
    this.toNode = null;

    /** @type {Function|null} 选择回调 */
    this._onChange = null;

    this._setupEvents();
  }

  /**
   * @param {SearchItem[]} items
   */
  buildIndex(items) {
    this.index = items;
  }

  /** 模糊搜索 */
  search(query) {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return this.index
      .filter(item =>
        item.label.toLowerCase().includes(q) ||
        (item.keywords || []).some(k => k.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }

  _showSuggestions(input, suggestEl, role) {
    const results = this.search(input.value);
    suggestEl.innerHTML = '';
    if (results.length === 0) { suggestEl.style.display = 'none'; return; }
    suggestEl.style.display = 'block';
    for (const r of results) {
      const li = document.createElement('li');
      li.textContent = r.label + (r.building ? ` (${r.building})` : '');
      li.addEventListener('click', () => {
        input.value = r.label;
        suggestEl.style.display = 'none';
        if (role === 'from') this.fromNode = r;
        else this.toNode = r;
        if (this._onChange) this._onChange(role, r);
      });
      suggestEl.appendChild(li);
    }
  }

  _setupEvents() {
    this.fromInput.addEventListener('input', () =>
      this._showSuggestions(this.fromInput, this.fromSuggest, 'from'));
    this.toInput.addEventListener('input', () =>
      this._showSuggestions(this.toInput, this.toSuggest, 'to'));

    // 点击外部关闭建议
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-field')) {
        this.fromSuggest.style.display = 'none';
        this.toSuggest.style.display = 'none';
      }
    });
  }

  /**
   * 外部设置起点/终点（如从地图点击）
   */
  setFrom(item) {
    this.fromInput.value = item.label;
    this.fromNode = item;
    if (this._onChange) this._onChange('from', item);
  }

  setTo(item) {
    this.toInput.value = item.label;
    this.toNode = item;
    if (this._onChange) this._onChange('to', item);
  }

  setRole(role, item) {
    if (role === 'from') this.setFrom(item);
    else this.setTo(item);
  }

  swap() {
    const tmpI = this.fromNode;
    const tmpV = this.fromInput.value;
    this.fromNode = this.toNode;
    this.fromInput.value = this.toInput.value;
    this.toNode = tmpI;
    this.toInput.value = tmpV;
    if (this._onChange) this._onChange('swap', null);
  }

  onChange(fn) { this._onChange = fn; }
}

/**
 * @typedef {Object} SearchItem
 * @property {string} id
 * @property {string} label
 * @property {string} type
 * @property {string} [building]
 * @property {string} [buildingId]
 * @property {string} [routeNodeId] - 实际送入 AStar 的 Graph 节点 ID
 * @property {string[]} [keywords]
 * @property {number} [x] - 区域图片像素 x
 * @property {number} [y] - 区域图片像素 y
 * @property {number} [lat] - 非正式区域数据的兼容坐标
 * @property {number} [lng] - 非正式区域数据的兼容坐标
 * @property {number} floor
 */

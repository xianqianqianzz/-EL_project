class SearchBox {
  constructor() {
    this.fromInput = document.getElementById('search-from');
    this.toInput = document.getElementById('search-to');
    this.fromSuggest = document.getElementById('suggestions-from');
    this.toSuggest = document.getElementById('suggestions-to');
    this.index = [];
    this.fromNode = null;
    this.toNode = null;
    this._onChange = null;
    this._setupEvents();
  }

  buildIndex(items) {
    this.index = items;
  }

  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.index.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.keywords || []).some(keyword => keyword.toLowerCase().includes(q))
    ).slice(0, 10);
  }

  setRole(role, item) {
    if (role === 'from') {
      this.fromNode = item;
      this.fromInput.value = item.label;
    } else {
      this.toNode = item;
      this.toInput.value = item.label;
    }
    if (this._onChange) this._onChange(role, item);
  }

  swap() {
    const from = this.fromNode;
    const fromValue = this.fromInput.value;
    this.fromNode = this.toNode;
    this.fromInput.value = this.toInput.value;
    this.toNode = from;
    this.toInput.value = fromValue;
    if (this._onChange) this._onChange('swap', null);
  }

  onChange(fn) {
    this._onChange = fn;
  }

  _showSuggestions(input, list, role) {
    const items = this.search(input.value);
    list.innerHTML = '';
    list.style.display = items.length ? 'block' : 'none';
    for (const item of items) {
      const option = document.createElement('li');
      option.textContent = item.label;
      option.addEventListener('click', () => {
        list.style.display = 'none';
        this.setRole(role, item);
      });
      list.appendChild(option);
    }
  }

  _setupEvents() {
    this.fromInput.addEventListener('input', () => this._showSuggestions(this.fromInput, this.fromSuggest, 'from'));
    this.toInput.addEventListener('input', () => this._showSuggestions(this.toInput, this.toSuggest, 'to'));
    document.addEventListener('click', event => {
      if (!event.target.closest('.search-field')) {
        this.fromSuggest.style.display = 'none';
        this.toSuggest.style.display = 'none';
      }
    });
  }
}

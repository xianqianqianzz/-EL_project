class InfoPanel {
  constructor() {
    this.emptySection = document.getElementById('panel-empty');
    this.routeSection = document.getElementById('panel-route');
  }

  showRoute(routeResult) {
    this.emptySection.classList.add('hidden');
    this.routeSection.classList.remove('hidden');
    const distance = routeResult.totalDistance;
    const minutes = Math.max(1, Math.round(distance / CONFIG.walkingSpeed / 60));
    this.routeSection.querySelector('.route-dist').textContent =
      distance < 1000 ? `${Math.round(distance)} 米` : `${(distance / 1000).toFixed(1)} 公里`;
    this.routeSection.querySelector('.route-time').textContent = `约 ${minutes} 分钟`;

    const segments = this.routeSection.querySelector('.route-segments');
    segments.innerHTML = '';
    const summary = document.createElement('div');
    summary.textContent = `室外步行 · ${routeResult.path.length} 个路网节点`;
    segments.appendChild(summary);

    const steps = this.routeSection.querySelector('.route-steps');
    steps.innerHTML = '';
    routeResult.path.forEach((node, index) => {
      const item = document.createElement('li');
      item.textContent = node.label || `路网节点 ${String(index + 1).padStart(3, '0')}`;
      steps.appendChild(item);
    });
  }

  showEmpty() {
    this.routeSection.classList.add('hidden');
    this.emptySection.classList.remove('hidden');
  }
}

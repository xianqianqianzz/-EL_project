/**
 * 标记点弹窗模块
 * 处理地图上标记点的交互行为
 */
class MarkerPopup {
  constructor(searchBox) {
    this.search = searchBox;
  }

  /**
   * 点击地图上的地点→设为起点或终点
   * @param {SearchItem} item
   */
  handleItemClick(item) {
    if (!this.search.fromNode) {
      this.search.setFrom(item);
    } else if (!this.search.toNode) {
      this.search.setTo(item);
    } else {
      // 已有起终点，替换终点
      this.search.setTo(item);
    }
  }

  /**
   * 将图形节点转为搜索条目（用于从数据构建搜索索引）
   */
  static nodeToItem(node) {
    return {
      id: node.id,
      label: node.label || node.id,
      type: node.type,
      building: node.building || undefined,
      buildingId: node.building || undefined,
      routeNodeId: node.id,
      lat: node.lat,
      lng: node.lng,
      floor: node.floor || 0
    };
  }
}

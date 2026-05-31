/**
 * 数据格式校验
 * 检查加载的 JSON 是否符合预期 schema
 */
class DataValidator {
  static validateGraphNode(node, index) {
    const required = ['id', 'type', 'lat', 'lng', 'label'];
    const missing = required.filter(f => node[f] === undefined);
    if (missing.length) {
      console.warn(`节点 #${index} (${node.id || '?'}) 缺少字段: ${missing.join(', ')}`);
      return false;
    }
    if (typeof node.lat !== 'number' || typeof node.lng !== 'number') {
      console.warn(`节点 ${node.id} 坐标无效`);
      return false;
    }
    return true;
  }

  static validateEdge(edge, index) {
    if (!edge.from || !edge.to) {
      console.warn(`边 #${index} 缺少 from/to`);
      return false;
    }
    return true;
  }

  static validateBuilding(building, index) {
    if (!building.id || !building.name) {
      console.warn(`建筑 #${index} 缺少 id/name`);
      return false;
    }
    return true;
  }

  /**
   * 批量校验并输出报告
   */
  static report(name, items, validatorFn) {
    let ok = 0, fail = 0;
    for (let i = 0; i < items.length; i++) {
      validatorFn(items[i], i) ? ok++ : fail++;
    }
    console.log(`[校验] ${name}: ${ok} 通过, ${fail} 失败 (共 ${items.length})`);
    return { ok, fail, total: items.length };
  }
}

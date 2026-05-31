/**
 * 数据加载器
 * 负责加载 JSON 数据文件
 */
class DataLoader {
  /**
   * @param {string} path - JSON 文件路径
   * @returns {Promise<Object>}
   */
  static async loadJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`加载 ${path} 失败: ${resp.status}`);
    return resp.json();
  }

  /**
   * 批量加载
   * @param {string[]} paths
   * @returns {Promise<Object[]>}
   */
  static async loadAll(paths) {
    return Promise.all(paths.map(p => DataLoader.loadJSON(p)));
  }

  /**
   * 加载室内建筑数据
   * @param {string} buildingId
   * @returns {Promise<Object>}
   */
  static async loadIndoor(buildingId) {
    return DataLoader.loadJSON(`${CONFIG.dataPaths.indoorDir}${buildingId}.json`);
  }
}

/**
 * 全局配置
 * 南京大学仙林校区中心坐标：约 32.119°N, 118.957°E
 */
const CONFIG = {
  // 地图默认中心（南大仙林校区）
  center: [32.119, 118.957],
  defaultZoom: 16,
  maxZoom: 20,
  minZoom: 14,

  // 地图瓦片（使用 OpenStreetMap，国内可替换为高德/天地图）
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',

  // 步行速度（米/秒），用于估算时间
  walkingSpeed: 1.2,

  // 数据文件路径
  dataPaths: {
    buildings: 'data/buildings.json',
    outdoorNodes: 'data/outdoor-nodes.json',
    outdoorPaths: 'data/outdoor-paths.json',
    outdoorTargets: 'data/outdoor-targets.json',
    indoorDir: 'data/indoor/'
  },

  // 室内地图绘制参数
  indoor: {
    pixelsPerMeter: 6,
    corridorWidth: 14,  // 像素
    roomMinSize: 20,
    nodeRadius: 3       // 路径节点圆点大小
  }
};

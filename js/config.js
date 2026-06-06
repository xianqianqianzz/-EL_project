/**
 * 全局配置
 * 南京大学仙林校区中心坐标：约 32.119°N, 118.957°E
 */
const CONFIG = {
  // 步行速度（米/秒），用于估算时间
  walkingSpeed: 1.2,

  // 数据文件路径
  dataPaths: {
    areasIndex: 'data/areas/index.json'
  },

  // 室内地图绘制参数
  indoor: {
    pixelsPerMeter: 6,
    corridorWidth: 14,  // 像素
    roomMinSize: 20,
    nodeRadius: 3       // 路径节点圆点大小
  }
};

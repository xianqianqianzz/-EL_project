const CONFIG = {
  apiBase: 'http://localhost:8000',
  walkingSpeed: 1.2,
  dataPaths: {
    areasIndex: ['http://localhost:8000/api/v1/areas', 'data/areas/index.json']
  },
  indoor: {
    pixelsPerMeter: 6,
    corridorWidth: 14,
    roomMinSize: 20,
    nodeRadius: 3
  }
};

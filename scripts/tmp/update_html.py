import re

path = r"C:/Users/ytj/Desktop/-EL_project/index.html"
with open(path, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Add indoor map container between outdoor-map and map-controls
old_map = '<div id="outdoor-map"></div>\n      <div class="map-controls">'
new_map = '<div id="outdoor-map"></div>\n      <div id="indoor-map" class="hidden">\n        <div class="indoor-toolbar">\n          <button id="btn-back-outdoor">&#8592; 返回室外</button>\n          <span class="indoor-title"></span>\n          <div id="floor-selector" class="floor-selector"></div>\n        </div>\n        <div id="indoor-map-inner"></div>\n      </div>\n      <div class="map-controls">'
html = html.replace(old_map, new_map)

# 2. Add indoor-related scripts before app.js
old_scripts = '<script src="js/app.js?v=area-v4"></script>'
new_scripts = '<script src="js/nav/indoor-graph.js?v=area-v4"></script>\n  <script src="js/map/indoor.js?v=area-v4"></script>\n  <script src="js/map/layer-switch.js?v=area-v4"></script>\n  <script src="js/app.js?v=area-v4"></script>'
html = html.replace(old_scripts, new_scripts)

# 3. Update title
html = html.replace("<title>南京大学仙林校区地图</title>", "<title>南京大学校园地图</title>")

with open(path, "w", encoding="utf-8") as f:
    f.write(html)
print("index.html updated")

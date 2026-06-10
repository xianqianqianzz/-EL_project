"""
NJU Campus Map - Backend API Server
"""
import json, os, math
from pathlib import Path
from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NJU Campus Map API")

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE = Path(__file__).parent
DATA_DIR = BASE / "data" / "areas"

# ========== Helper ==========
def load_index():
    with open(DATA_DIR / "index.json", "r", encoding="utf-8") as f:
        return json.load(f)

def load_area(area_id):
    idx = load_index()
    for a in idx["areas"]:
        if a["id"] == area_id:
            path = BASE / a["path"]
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    return None

def heuristic(a, b):
    return math.sqrt((a["x"]-b["x"])**2 + (a["y"]-b["y"])**2)

def a_star(nodes, edges, start_id, end_id):
    node_map = {n["id"]: n for n in nodes}
    adj = {}
    for e in edges:
        adj.setdefault(e["from"], []).append(e["to"])
        adj.setdefault(e["to"], []).append(e["from"])
    
    if start_id not in node_map or end_id not in node_map:
        return None
    
    open_set = {start_id}
    came_from = {}
    g = {start_id: 0}
    f = {start_id: heuristic(node_map[start_id], node_map[end_id])}
    
    while open_set:
        current = min(open_set, key=lambda x: f.get(x, float("inf")))
        if current == end_id:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start_id)
            path.reverse()
            return path
        open_set.remove(current)
        for nb in adj.get(current, []):
            tg = g[current] + heuristic(node_map[current], node_map[nb])
            if tg < g.get(nb, float("inf")):
                came_from[nb] = current
                g[nb] = tg
                f[nb] = tg + heuristic(node_map[nb], node_map[end_id])
                open_set.add(nb)
    return None

# ========== API Endpoints ==========

@app.get("/api/areas")
def get_areas():
    """Get all available areas/campuses"""
    idx = load_index()
    return idx["areas"]

@app.get("/api/places")
def get_places(area: str = "outdoor-xianlin"):
    """Get all places for a given area"""
    data = load_area(area)
    if not data:
        return JSONResponse({"error": "area not found"}, 404)
    return data.get("places", [])

@app.get("/api/places/{place_id}")
def get_place_detail(place_id: str, area: str = "outdoor-xianlin"):
    """Get detail for a specific place"""
    data = load_area(area)
    if not data:
        return JSONResponse({"error": "area not found"}, 404)
    for p in data.get("places", []):
        if p["id"] == place_id:
            return p
    return JSONResponse({"error": "place not found"}, 404)

@app.get("/api/search")
def search_places(q: str = Query(..., min_length=1), area: str = "outdoor-xianlin"):
    """Search places by keyword"""
    data = load_area(area)
    if not data:
        return JSONResponse({"error": "area not found"}, 404)
    q = q.lower()
    results = [p for p in data.get("places", []) if q in p["label"].lower()]
    return results[:10]

@app.get("/api/route")
def get_route(from_id: str = Query(...), to_id: str = Query(...), area: str = "outdoor-xianlin"):
    """Calculate route between two places/nodes"""
    data = load_area(area)
    if not data:
        return JSONResponse({"error": "area not found"}, 404)
    
    # Resolve place IDs to node IDs
    place_map = {p["id"]: p for p in data.get("places", [])}
    start_node = from_id
    end_node = to_id
    if from_id in place_map:
        start_node = place_map[from_id]["routeNodeId"]
    if to_id in place_map:
        end_node = place_map[to_id]["routeNodeId"]
    
    path = a_star(data["nodes"], data["edges"], start_node, end_node)
    if not path:
        return JSONResponse({"error": "no route found"}, 404)
    
    # Calculate distance
    meters_per_pixel = data["image"]["metersPerPixel"]
    node_map = {n["id"]: n for n in data["nodes"]}
    dist = 0
    for i in range(1, len(path)):
        a = node_map[path[i-1]]
        b = node_map[path[i]]
        dist += math.sqrt((a["x"]-b["x"])**2 + (a["y"]-b["y"])**2)
    dist *= meters_per_pixel
    
    # Build path with labels
    path_detail = []
    for nid in path:
        label = nid
        for p in data.get("places", []):
            if p["routeNodeId"] == nid:
                label = p["label"]
                break
        path_detail.append({"id": nid, "label": label})
    
    return {
        "path": path_detail,
        "distance_m": round(dist),
        "time_min": max(1, round(dist / 1.2 / 60))
    }


@app.get("/api/area-data/{area_id}")
def get_area_data(area_id: str):
    """Get complete area data including nodes and edges"""
    data = load_area(area_id)
    if not data:
        return JSONResponse({"error": "area not found"}, 404)
    return data

@app.get("/api/area-info")
def get_area_info(area: str = "outdoor-xianlin"):
    """Get area metadata"""
    data = load_area(area)
    if not data:
        return JSONResponse({"error": "area not found"}, 404)
    return {
        "name": data.get("name", ""),
        "places_count": len(data.get("places", [])),
        "nodes_count": len(data.get("nodes", [])),
        "edges_count": len(data.get("edges", [])),
        "image": data.get("image", {})
    }

@app.get("/api/buildings")
def get_buildings():
    path = BASE / "data" / "indoor" / "buildings.json"
    if not path.exists():
        return JSONResponse({"error": "buildings.json not found"}, 404)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# ========== Static Files (after API routes) ==========
@app.get("/")
def root():
    return FileResponse(BASE / "index.html")

app.mount("/", StaticFiles(directory=str(BASE), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

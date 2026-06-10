path = r"C:/Users/ytj/Desktop/-EL_project/server.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

marker = "# ========== Static Files (after API routes) =========="
new_code = """@app.get("/api/buildings")
def get_buildings():
    path = BASE / "data" / "indoor" / "buildings.json"
    if not path.exists():
        return JSONResponse({"error": "buildings.json not found"}, 404)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

"""
content = content.replace(marker, new_code + marker)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("server.py updated")

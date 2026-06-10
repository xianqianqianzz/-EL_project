import json, os, glob

base = r"C:/Users/ytj/Desktop/-EL_project/assets/floor-plans"
buildings = []

jpgs = sorted(glob.glob(os.path.join(base, "*.jpg")), key=lambda x: int(os.path.splitext(os.path.basename(x))[0]) if os.path.splitext(os.path.basename(x))[0].isdigit() else 0)

for jpg in jpgs:
    name = os.path.basename(jpg)
    num = os.path.splitext(name)[0]
    if not num.isdigit():
        continue
    
    lf_path = os.path.join(base, f"linkfox-{num}.json")
    desc = None
    if os.path.exists(lf_path):
        try:
            with open(lf_path, "r", encoding="utf-8") as f:
                ld = json.load(f)
                desc = ld.get("text", "") or ld.get("stdout", "") or ""
        except:
            pass
    
    floor_label = "平面图"
    if desc:
        lines = [l.strip() for l in desc.split("\n") if l.strip() and not l.startswith("##")]
        if lines:
            first = lines[0].replace("##", "").strip()
            if len(first) > 30:
                first = first[:30] + "..."
            floor_label = first if first else "平面图"
    
    bldg_name = f"建筑{num}"
    if desc:
        dl = desc.lower()
        if any(k in desc for k in ["图书馆", "library"]):
            bldg_name = f"图书馆{num}"
        elif any(k in dl for k in ["宿舍", "dorm"]):
            bldg_name = f"宿舍楼{num}"
        elif any(k in desc for k in ["教学", "教室", "teaching"]):
            bldg_name = f"教学楼{num}"
        elif any(k in dl for k in ["实验", "lab"]):
            bldg_name = f"实验楼{num}"
        elif any(k in desc for k in ["办公", "office"]):
            bldg_name = f"办公楼{num}"
        elif any(k in desc for k in ["食堂", "餐厅", "canteen"]):
            bldg_name = f"食堂{num}"
        elif any(k in dl for k in ["体育", "gym"]):
            bldg_name = f"体育馆{num}"
    
    buildings.append({
        "id": f"building-{num}",
        "name": bldg_name,
        "floors": [{
            "level": 1,
            "label": floor_label,
            "image": f"assets/floor-plans/{name}",
            "description": desc
        }]
    })

# 杜厦图书馆（多楼层）
library_floors = []
for lv in range(1, 6):
    lf_path = os.path.join(base, f"linkfox-library-{lv}f.json")
    desc = None
    if os.path.exists(lf_path):
        try:
            with open(lf_path, "r", encoding="utf-8") as f:
                ld = json.load(f)
                desc = ld.get("text", "") or ld.get("stdout", "") or ""
        except:
            pass
    library_floors.append({
        "level": lv,
        "label": f"{lv}F",
        "image": f"assets/screenshots/library-floor{lv}.jpg",
        "description": desc
    })

buildings.append({
    "id": "building-library",
    "name": "杜厦图书馆",
    "floors": library_floors
})

out_dir = r"C:/Users/ytj/Desktop/-EL_project/data/indoor"
os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, "buildings.json"), "w", encoding="utf-8") as f:
    json.dump(buildings, f, ensure_ascii=False, indent=2)

print(f"Generated {len(buildings)} buildings")
for b in buildings[:5]:
    print(b["id"], b["name"], len(b["floors"]), "floors")
print("...")
b = buildings[-1]
print(b["id"], b["name"], len(b["floors"]), "floors")

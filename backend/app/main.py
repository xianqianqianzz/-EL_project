from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app.area_repository import (
    AreaNotFoundError,
    AreaRepository,
    InvalidAreaDataError,
)
from backend.app.models import AreaIndexResponse, HealthResponse
from backend.app.auth_routes import router as auth_router
from backend.app.trip_routes import router as trip_router
from backend.app.proposal_routes import router as proposal_router


PROJECT_ROOT = Path(__file__).resolve().parents[2]
repository = AreaRepository(PROJECT_ROOT)

app = FastAPI(
    title="NJU Campus Map API",
    description="南京大学校园地图的版本化后端接口。",
    version="0.5.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(trip_router)
app.include_router(proposal_router)


def api_error(error: Exception) -> HTTPException:
    if isinstance(error, AreaNotFoundError):
        return HTTPException(status_code=404, detail="区域不存在")
    return HTTPException(status_code=500, detail=str(error))


@app.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="nju-campus-map-api", apiVersion="v1")


@app.get("/api/v1/areas", response_model=AreaIndexResponse, tags=["areas"])
def list_areas() -> AreaIndexResponse:
    try:
        return AreaIndexResponse.model_validate(repository.public_index())
    except InvalidAreaDataError as error:
        raise api_error(error) from error


@app.get("/api/v1/areas/{area_id}", tags=["areas"])
def get_area(area_id: str) -> JSONResponse:
    try:
        return JSONResponse(
            repository.get_area(area_id),
            headers={"Cache-Control": "no-store"},
        )
    except (AreaNotFoundError, InvalidAreaDataError) as error:
        raise api_error(error) from error


@app.get("/api/v1/areas/{area_id}/map", tags=["areas"])
def get_area_map(area_id: str) -> FileResponse:
    try:
        return FileResponse(repository.get_map_path(area_id))
    except (AreaNotFoundError, InvalidAreaDataError) as error:
        raise api_error(error) from error


@app.get("/", include_in_schema=False)
def frontend() -> FileResponse:
    return FileResponse(PROJECT_ROOT / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/{page_name}.html", include_in_schema=False)
def frontend_page(page_name: str) -> FileResponse:
    if page_name not in {"index", "login", "schedule"}:
        raise HTTPException(status_code=404, detail="页面不存在")
    return FileResponse(PROJECT_ROOT / f"{page_name}.html", headers={"Cache-Control": "no-store"})


for static_directory in ("css", "js", "data", "tools", "assets"):
    path = PROJECT_ROOT / static_directory
    if path.is_dir():
        app.mount(f"/{static_directory}", StaticFiles(directory=path), name=static_directory)

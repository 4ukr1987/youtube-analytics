"""
Niche Data Harvester & Auto-Scheduler Router.
Triggers on-demand deep ingestion of niche videos, channels, and outliers into SQLite,
as well as background nightly scheduled harvesting.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.youtube_service import YouTubeService
from services.db_service import DatabaseService
from services.harvester_service import HarvesterService, HarvesterScheduler

router = APIRouter(prefix="/api/harvester", tags=["Data Harvester"])

yt_service = YouTubeService()
db_service = DatabaseService()
harvester_service = HarvesterService(yt_service, db_service)
scheduler = HarvesterScheduler(harvester_service)

# Start scheduler background monitor
try:
    scheduler.start()
except Exception:
    pass


class HarvestRequest(BaseModel):
    niche: str
    limit: Optional[int] = 40

class SchedulerToggleRequest(BaseModel):
    enabled: bool
    interval_hours: Optional[int] = 24


@router.post("/run")
async def run_niche_harvest(req: HarvestRequest):
    """Executes on-demand deep scrape & ingestion of a niche into SQLite"""
    try:
        result = harvester_service.harvest_niche_data(
            niche=req.niche,
            limit=req.limit or 40
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/scheduler/status")
async def get_scheduler_status():
    """Returns current auto-scheduler settings and last run info"""
    try:
        settings = db_service.get_harvester_settings()
        return {
            "status": "success",
            "scheduler": settings
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scheduler/toggle")
async def toggle_scheduler(req: SchedulerToggleRequest):
    """Enables or disables automatic background harvesting"""
    try:
        db_service.update_harvester_settings(req.enabled, req.interval_hours or 24)
        settings = db_service.get_harvester_settings()
        return {
            "status": "success",
            "message": "Расписание автосбора успешно обновлено" if req.enabled else "Автосбор отключен",
            "scheduler": settings
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scheduler/trigger-now")
async def trigger_scheduler_now():
    """Immediately triggers a scheduled pass across core niches"""
    try:
        res = scheduler.trigger_now()
        settings = db_service.get_harvester_settings()
        return {
            "status": "success",
            "message": f"Сбор завершен! Добавлено {res.get('videos_harvested', 0)} видео в базу.",
            "result": res,
            "scheduler": settings
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

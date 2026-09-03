"""
Time-Series Database History & Watchlist Router.
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from services.db_service import DatabaseService

router = APIRouter(tags=["Database & Watchlist"])

db_service = DatabaseService()


class WatchlistToggleRequest(BaseModel):
    channel_id: str


@router.get("/api/history")
async def get_channel_history(channel_id: str = Query(..., description="Channel ID"), days: int = 30):
    """Returns time-series history data for chart rendering"""
    try:
        history = db_service.get_channel_history(channel_id, days=days)
        return {
            "status": "success",
            "channel_id": channel_id,
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/watchlist")
async def get_watchlist():
    """Returns all tracked channels in the SQLite database"""
    try:
        watchlist = db_service.get_watchlist()
        return {
            "status": "success",
            "watchlist": watchlist
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/watchlist/toggle")
async def toggle_watchlist(req: WatchlistToggleRequest):
    """Adds or removes a channel from the watchlist"""
    try:
        is_active = db_service.toggle_watchlist(req.channel_id)
        return {
            "status": "success",
            "channel_id": req.channel_id,
            "is_watchlist": is_active
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/database/stats")
async def get_database_stats():
    """Returns local SQLite database vault metrics and quota savings"""
    try:
        stats = db_service.get_database_vault_stats()
        return {
            "status": "success",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

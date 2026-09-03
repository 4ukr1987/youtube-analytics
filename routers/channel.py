"""
Channel Audit, Analytics & Outliers Router.
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from services.youtube_service import YouTubeService
from services.analytics_engine import AnalyticsEngine
from services.db_service import DatabaseService

router = APIRouter(tags=["Channel & Outliers"])

yt_service = YouTubeService()
analytics_engine = AnalyticsEngine()
db_service = DatabaseService()


class CompetitorRequest(BaseModel):
    channel_1: str
    channel_2: str


@router.get("/api/channel")
async def get_channel_audit(q: str = Query(..., description="Channel URL, @handle, or Channel ID"), limit: int = 50):
    """Full channel deep audit + auto-records snapshot in SQLite database"""
    try:
        overview = yt_service.get_channel_overview(q)
        channel_id = overview.get('id')
        videos = yt_service.get_channel_videos_rich(channel_id, limit=limit)
        analytics = analytics_engine.process_channel_analytics(overview, videos)

        # Save snapshot in database
        try:
            db_service.record_channel_snapshot(overview, analytics)
        except Exception as e:
            print(f"DB snapshot error: {e}")

        return {
            "status": "success",
            "overview": overview,
            "analytics": analytics
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/competitors/compare")
async def compare_competitors(req: CompetitorRequest):
    """Head-to-head comparison of two YouTube channels"""
    try:
        ov_1 = yt_service.get_channel_overview(req.channel_1)
        vids_1 = yt_service.get_channel_videos_rich(ov_1['id'], limit=20)
        an_1 = analytics_engine.process_channel_analytics(ov_1, vids_1)

        ov_2 = yt_service.get_channel_overview(req.channel_2)
        vids_2 = yt_service.get_channel_videos_rich(ov_2['id'], limit=20)
        an_2 = analytics_engine.process_channel_analytics(ov_2, vids_2)

        comparison = analytics_engine.compare_channels(
            {"overview": ov_1, "analytics": an_1},
            {"overview": ov_2, "analytics": an_2}
        )
        return {"status": "success", "comparison": comparison}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

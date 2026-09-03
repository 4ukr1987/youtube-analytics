"""
Best Time to Post Heatmap Router (vidIQ & ViewStats Competitor).
"""

from fastapi import APIRouter, Query, HTTPException
from services.best_time_service import BestTimeService
from services.youtube_service import YouTubeService
from services.ai_assistant import AIAssistant

router = APIRouter(prefix="/api/best-time", tags=["Best Time to Post"])

yt_service = YouTubeService()
ai_assistant = AIAssistant()
best_time_service = BestTimeService(yt_service, ai_assistant)


@router.get("")
async def get_best_time_heatmap(
    channel_id: str = Query("@veritasium", description="Channel URL, handle or ID"),
    tz_offset: int = Query(3, description="Timezone UTC offset in hours (-12 to +14)")
):
    """Calculates 7x24 audience activity matrix and Golden Hours for publishing"""
    try:
        data = best_time_service.calculate_best_time_matrix(
            channel_query=channel_id,
            tz_offset=tz_offset
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

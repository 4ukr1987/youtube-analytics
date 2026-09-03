"""
Outlier Intelligence Router (1of10 & ViewStats Competitor).
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from services.outlier_service import OutlierService
from services.youtube_service import YouTubeService
from services.ai_assistant import AIAssistant

router = APIRouter(prefix="/api/outliers", tags=["Outlier Hunter"])

yt_service = YouTubeService()
ai_assistant = AIAssistant()
outlier_service = OutlierService(yt_service, ai_assistant)


class ViralBreakdownRequest(BaseModel):
    title: str
    channel_title: str
    views: int
    multiplier: float

class RemixRequest(BaseModel):
    title: str
    niche: Optional[str] = ""


@router.get("/niche")
async def search_niche_outliers(
    topic: str = Query(..., description="Niche keyword or topic"),
    min_multiplier: float = Query(2.0, description="Minimum outlier multiplier"),
    max_subs: Optional[int] = Query(None, description="Max channel subscribers filter"),
    limit: int = Query(25, description="Max results limit")
):
    """Searches YouTube across a niche and finds breakout viral videos with high outlier multipliers"""
    try:
        outliers = outlier_service.search_niche_outliers(
            topic=topic,
            min_multiplier=min_multiplier,
            max_channel_subs=max_subs,
            limit=limit
        )
        return {
            "status": "success",
            "topic": topic,
            "count": len(outliers),
            "outliers": outliers
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/breakdown")
async def get_viral_breakdown(req: ViralBreakdownRequest):
    """Uses Gemini to extract the viral psychology DNA behind an outlier"""
    try:
        breakdown = outlier_service.generate_viral_breakdown(
            title=req.title,
            channel_title=req.channel_title,
            views=req.views,
            multiplier=req.multiplier
        )
        return {
            "status": "success",
            "breakdown": breakdown
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/remix")
async def remix_outlier(req: RemixRequest):
    """Generates 3 adapted, personalized titles and hooks for the creator's channel"""
    try:
        remixes = outlier_service.remix_outlier_for_channel(
            title=req.title,
            creator_niche=req.niche or ""
        )
        return {
            "status": "success",
            "original_title": req.title,
            "remixes": remixes
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

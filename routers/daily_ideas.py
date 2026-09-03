"""
AI Daily Ideas Router (vidIQ Boost Feature).
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from services.daily_ideas_service import DailyIdeasService
from services.db_service import DatabaseService
from services.ai_assistant import AIAssistant
from services.keyword_service import KeywordService
from services.youtube_service import YouTubeService

router = APIRouter(prefix="/api/daily-ideas", tags=["Daily Ideas"])

yt_service = YouTubeService()
db_service = DatabaseService()
ai_assistant = AIAssistant()
keyword_service = KeywordService(yt_service)
daily_ideas_service = DailyIdeasService(db_service, ai_assistant, keyword_service)


class DailyIdeaGenerateRequest(BaseModel):
    niche: Optional[str] = "YouTube & ИИ"

class DailyIdeaStatusRequest(BaseModel):
    id: str
    status: str


@router.get("")
async def get_daily_ideas(niche: str = Query("YouTube & ИИ", description="Channel niche"), status: Optional[str] = Query(None, description="Status filter")):
    """Returns AI Daily Ideas with virality potential and card action states"""
    try:
        ideas = daily_ideas_service.get_ideas(niche=niche, status=status)
        return {
            "status": "success",
            "niche": niche,
            "ideas": ideas
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/generate")
async def generate_daily_ideas(req: DailyIdeaGenerateRequest):
    """Forces generation of a fresh batch of 5 daily ideas"""
    try:
        ideas = daily_ideas_service.generate_fresh_daily_ideas(niche=req.niche or "YouTube & ИИ")
        return {
            "status": "success",
            "niche": req.niche,
            "ideas": ideas
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/status")
async def update_daily_idea_status(req: DailyIdeaStatusRequest):
    """Updates idea status ('saved', 'dismissed', 'new')"""
    try:
        success = daily_ideas_service.update_idea_status(req.id, req.status)
        return {
            "status": "success",
            "id": req.id,
            "new_status": req.status,
            "updated": success
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

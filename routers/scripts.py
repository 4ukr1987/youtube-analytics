"""
AI Full Video Script & Shorts Generator Router (vidIQ Max Grade).
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.script_service import ScriptService
from services.ai_assistant import AIAssistant

router = APIRouter(prefix="/api/scripts", tags=["AI Scripts"])

ai_assistant = AIAssistant()
script_service = ScriptService(ai_assistant)


class FullScriptRequest(BaseModel):
    topic: str
    duration_minutes: Optional[int] = 10
    target_audience: Optional[str] = "Широкая аудитория"
    tone: Optional[str] = "Энергичный и увлекательный"


class ShortsRequest(BaseModel):
    topic: str


@router.post("/full")
async def generate_full_video_script(req: FullScriptRequest):
    """Generates a complete minute-by-minute YouTube video script with B-roll cues"""
    try:
        data = script_service.generate_full_script(
            topic=req.topic,
            duration_minutes=req.duration_minutes or 10,
            target_audience=req.target_audience or "Широкая аудитория",
            tone=req.tone or "Энергичный и увлекательный"
        )
        return {"status": "success", "script": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/shorts")
async def generate_shorts_pack(req: ShortsRequest):
    """Generates 3 viral YouTube Shorts / Reels scripts with hooks & visual actions"""
    try:
        data = script_service.generate_shorts_pack(topic=req.topic)
        return {"status": "success", "shorts": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/titles")
async def generate_viral_titles_scripts(req: dict):
    """Generates 8-10 high-CTR viral title variations"""
    try:
        topic = req.get("topic", "")
        audience = req.get("target_audience", "") or req.get("audience", "")
        titles = ai_assistant.generate_titles(topic, audience)
        return {"status": "success", "topic": topic, "titles": titles}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

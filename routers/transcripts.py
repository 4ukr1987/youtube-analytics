"""
Video Subtitles, Transcripts & AI Executive Summary Router.
"""

from fastapi import APIRouter, Query, HTTPException
from services.transcript_service import TranscriptService
from services.ai_assistant import AIAssistant
from services.youtube_service import YouTubeService

router = APIRouter(prefix="/api/transcript", tags=["Transcripts"])

yt_service = YouTubeService()
ai_assistant = AIAssistant()
transcript_service = TranscriptService(ai_assistant)


@router.get("")
async def get_video_transcript(video_id: str = Query(..., description="YouTube Video ID or URL"), lang: str = "ru"):
    """Extracts video subtitles/transcript, timestamps, and generates AI executive summary"""
    try:
        vid_id = yt_service.extract_video_id(video_id) or video_id
        transcript_data = transcript_service.extract_transcript(vid_id, lang=lang)
        return {
            "status": "success",
            "data": transcript_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/hook-analysis")
async def analyze_hook(body: dict):
    """Analyzes intro cues and generates 3 killer hook variations"""
    try:
        intro_text = body.get("intro_text", "")
        video_title = body.get("video_title", "")
        res = ai_assistant.analyze_retention_hook(intro_text, video_title=video_title)
        return {"status": "success", "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/repurpose-shorts")
async def repurpose_shorts(body: dict):
    """Extracts 3 high-impact viral Shorts/Reels scripts from transcript"""
    try:
        full_text = body.get("full_text", "")
        video_title = body.get("video_title", "")
        res = ai_assistant.repurpose_to_shorts(full_text, video_title=video_title)
        return {"status": "success", "data": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

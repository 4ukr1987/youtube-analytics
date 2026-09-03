"""
AI Growth Studio (Viral Titles, Ideas, SEO Descriptions) Router.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ai_assistant import AIAssistant

router = APIRouter(prefix="/api/ai", tags=["AI Growth Studio"])

ai_assistant = AIAssistant()


class TitleRequest(BaseModel):
    topic: str
    audience: Optional[str] = ""

class IdeaRequest(BaseModel):
    niche: str

class MetadataRequest(BaseModel):
    title: str
    niche: Optional[str] = ""

class CommentsMiningRequest(BaseModel):
    video_id: str
    title: Optional[str] = ""
    max_comments: Optional[int] = 100


@router.post("/titles")
async def generate_viral_titles(req: TitleRequest):
    """Generates 8-10 high-CTR viral title variations categorized by psychological triggers"""
    try:
        titles = ai_assistant.generate_titles(req.topic, req.audience or "")
        return {"status": "success", "topic": req.topic, "titles": titles}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ideas")
async def generate_video_ideas(req: IdeaRequest):
    """Generates 5 distinct high-potential video concepts"""
    try:
        ideas = ai_assistant.generate_video_ideas(req.niche)
        return {"status": "success", "niche": req.niche, "ideas": ideas}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/seo-metadata")
async def generate_seo_metadata(req: MetadataRequest):
    """Generates full optimized description with timestamps and 15 targeted tags"""
    try:
        meta = ai_assistant.generate_seo_metadata(req.title, req.niche or "")
        return {"status": "success", "metadata": meta}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/comments-mining")
async def mine_comments_pain_points(req: CommentsMiningRequest):
    """
    Fetches real YouTube comments for a video and runs Gemini 3.8 to cluster viewer pain points,
    questions, emotional triggers, and next video topics.
    """
    try:
        from services.youtube_service import YouTubeService
        yt = YouTubeService()
        
        # 1. Fetch comments
        comments = yt.get_video_comments(req.video_id, max_results=req.max_comments or 100)
        
        # Resolve title if not passed
        vid_title = req.title
        if not vid_title:
            vinfo = yt.get_video_deep_details(req.video_id)
            vid_title = vinfo.get('title') if vinfo else req.video_id
            
        # 2. Mine pain points via Gemini
        analysis = ai_assistant.analyze_audience_pain_points(vid_title, comments)
        
        return {
            "status": "success",
            "video_id": req.video_id,
            "video_title": vid_title,
            "comments_count": len(comments),
            "analysis": analysis,
            "sample_comments": comments[:15]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


"""
Video SEO Audit & Deep Inspection Router.
"""

from fastapi import APIRouter, Query, HTTPException
from services.youtube_service import YouTubeService
from services.seo_analyzer import SEOAnalyzer

router = APIRouter(prefix="/api/video", tags=["Video SEO"])

yt_service = YouTubeService()
seo_analyzer = SEOAnalyzer()


@router.get("")
async def get_video_seo_audit(url: str = Query(..., description="YouTube Video URL or Video ID")):
    """Deep video inspection: SEO score (0-100), checklist, hidden tags, VPH, ER"""
    try:
        video_details = yt_service.get_video_deep_details(url)
        seo_report = seo_analyzer.analyze_video(video_details)

        return {
            "status": "success",
            "video": video_details,
            "seo": seo_report
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

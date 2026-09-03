"""
Keyword Research Lab & Search Volume Router.
"""

from fastapi import APIRouter, Query, HTTPException
from services.keyword_service import KeywordService
from services.youtube_service import YouTubeService

router = APIRouter(prefix="/api/keywords", tags=["Keyword Lab"])

yt_service = YouTubeService()
keyword_service = KeywordService(yt_service)


@router.get("")
async def get_keyword_analysis(q: str = Query(..., description="Keyword to analyze")):
    """Calculates search volume, competition score, opportunity index, and top ranking videos"""
    try:
        result = keyword_service.analyze_keyword(q)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

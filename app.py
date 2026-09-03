"""
YouTube Growth & Analytics Suite (vidIQ Web Alternative)
Modular FastAPI Backend Application
"""

import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Import modular routers
from routers.video import router as video_router
from routers.channel import router as channel_router
from routers.daily_ideas import router as daily_ideas_router
from routers.transcripts import router as transcripts_router
from routers.history import router as history_router
from routers.studio import router as studio_router
from routers.ab_tests import router as ab_tests_router
from routers.bulk import router as bulk_router
from routers.keywords import router as keywords_router
from routers.ai import router as ai_router
from routers.outliers import router as outliers_router
from routers.thumbnail_preview import router as thumbnail_preview_router
from routers.best_time import router as best_time_router
from routers.scripts import router as scripts_router
from routers.harvester import router as harvester_router
from routers.radar import router as radar_router

from services.youtube_service import YouTubeService
from services.ai_assistant import AIAssistant

app = FastAPI(
    title="YouTube Analytics & Growth Studio",
    description="vidIQ Competitor Web Platform for YouTube Creators & Marketers",
    version="3.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

yt_service = YouTubeService()
ai_assistant = AIAssistant()


@app.get("/api/status")
async def get_system_status():
    """System health check & feature availability"""
    return {
        "youtube_api_configured": yt_service.is_api_configured(),
        "gemini_ai_configured": ai_assistant.is_ai_configured(),
        "database_connected": True,
        "version": "3.0.0",
        "architecture": "Modular APIRouter",
        "features": [
            "Video SEO Audit (0-100)",
            "AI Daily Ideas (vidIQ Boost)",
            "AI Full Video Script & Shorts Studio (vidIQ Max)",
            "Thumbnail Feed Simulator & Visual Lab",
            "Best Time to Post Heatmap (7x24)",
            "Niche & Channel Outlier Hunter (1of10 Grade)",
            "Video Transcripts & AI Summary",
            "YouTube Studio Retention & CTR",
            "Time-Series Database & Watchlist",
            "A/B Testing Engine",
            "Bulk Description & Tag Editor"
        ]
    }


# Mount all modular routers
app.include_router(video_router)
app.include_router(channel_router)
app.include_router(daily_ideas_router)
app.include_router(scripts_router)
app.include_router(outliers_router)
app.include_router(thumbnail_preview_router)
app.include_router(best_time_router)
app.include_router(transcripts_router)
app.include_router(history_router)
app.include_router(studio_router)
app.include_router(ab_tests_router)
app.include_router(bulk_router)
app.include_router(keywords_router)
app.include_router(ai_router)
app.include_router(harvester_router)
app.include_router(radar_router)

from fastapi.responses import FileResponse

# Mount static frontend
static_dir = os.path.join(os.path.dirname(__file__), "static")

@app.get("/privacy", include_in_schema=False)
async def privacy_page():
    return FileResponse(os.path.join(static_dir, "privacy.html"))

@app.get("/terms", include_in_schema=False)
async def terms_page():
    return FileResponse(os.path.join(static_dir, "terms.html"))

if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


"""
Competitor Spy Radar Router -
Monitors competitor channels in real-time, calculates live VPH velocity,
and flags high-performing breakouts and viral videos.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from services.youtube_service import YouTubeService
from services.analytics_engine import AnalyticsEngine
from services.db_service import DatabaseService
from datetime import datetime, timezone
import time

router = APIRouter(prefix="/api/radar", tags=["Competitor Spy Radar"])

yt = YouTubeService()
analytics = AnalyticsEngine()
db = DatabaseService()


class TrackCompetitorRequest(BaseModel):
    channel_query: str


@router.get("/competitors")
async def get_tracked_competitors():
    """Returns all tracked competitor channels"""
    try:
        comps = db.get_tracked_competitors()
        return {"status": "success", "competitors": comps}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/track")
async def track_competitor(req: TrackCompetitorRequest):
    """Fetches channel details and adds it to live radar tracking"""
    try:
        query = req.channel_query.strip()
        if not query:
            raise ValueError("Укажите @handle, ссылку или ID канала")

        overview = yt.get_channel_overview(query)
        if not overview or not overview.get('id'):
            raise ValueError(f"Канал '{query}' не найден на YouTube")

        # Get recent videos to compute baseline median
        recent_vids = yt.get_channel_videos_rich(overview['id'], limit=20)
        calc = analytics.process_channel_analytics(overview, recent_vids)
        median_views = calc.get('median_views', 1000)

        ch_data = {
            "id": overview['id'],
            "title": overview.get('title'),
            "custom_url": overview.get('custom_url', ''),
            "avatar": overview.get('thumbnail', ''),
            "subscribers": overview.get('subscribers', 0),
            "video_count": overview.get('video_count', 0),
            "median_views": median_views
        }

        db.add_tracked_competitor(ch_data)
        return {
            "status": "success",
            "message": f"Канал «{ch_data['title']}» успешно добавлен в Радар конкурентов!",
            "channel": ch_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/untrack/{channel_id}")
async def untrack_competitor(channel_id: str):
    """Removes a channel from radar tracking"""
    try:
        db.remove_tracked_competitor(channel_id)
        return {"status": "success", "message": "Канал удален из Радара"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/feed")
async def get_radar_feed(max_per_channel: int = Query(5, ge=1, le=15)):
    """
    Fetches the latest videos across all tracked competitors,
    calculates real-time VPH velocity, and flags viral breakout outliers.
    """
    try:
        comps = db.get_tracked_competitors()
        if not comps:
            return {
                "status": "success",
                "competitors_count": 0,
                "feed": [],
                "message": "Добавьте каналы-конкуренты в Радар для мониторинга новых роликов"
            }

        now_utc = datetime.now(timezone.utc)
        feed_items = []

        for c in comps:
            cid = c['channel_id']
            c_title = c.get('title')
            c_avatar = c.get('avatar')
            c_median = c.get('median_views') or 1000

            try:
                vids = yt.get_channel_videos_rich(cid, limit=max_per_channel)
                for v in vids:
                    published_str = v.get('published_at', '')
                    views = v.get('views', 0)
                    
                    # Calculate hours since published
                    hours = 24.0
                    if published_str:
                        try:
                            # Handle ISO format
                            p_clean = published_str.replace('Z', '+00:00')
                            p_dt = datetime.fromisoformat(p_clean)
                            delta = now_utc - p_dt
                            hours = max(delta.total_seconds() / 3600.0, 0.5)
                        except Exception:
                            hours = 24.0

                    vph = round(views / hours, 1)
                    ratio = round(views / max(c_median, 1), 2)
                    is_breakout = ratio >= 2.0 or vph >= 150.0

                    feed_items.append({
                        "video_id": v.get('id'),
                        "title": v.get('title'),
                        "thumbnail": v.get('thumbnail'),
                        "channel_id": cid,
                        "channel_title": c_title,
                        "channel_avatar": c_avatar,
                        "published_at": published_str[:10],
                        "hours_ago": round(hours, 1),
                        "views": views,
                        "likes": v.get('likes', 0),
                        "comments": v.get('comments', 0),
                        "duration": v.get('duration_formatted', '10:00'),
                        "vph": vph,
                        "channel_median": c_median,
                        "velocity_ratio": ratio,
                        "is_breakout": is_breakout
                    })
            except Exception as ch_err:
                print(f"Error fetching radar for {c_title}: {ch_err}")

        # Sort feed by VPH (highest velocity first)
        feed_items.sort(key=lambda x: x['vph'], reverse=True)

        return {
            "status": "success",
            "competitors_count": len(comps),
            "feed": feed_items
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

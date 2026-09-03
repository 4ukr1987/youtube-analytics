"""
Niche Data Harvester Service (On-Demand Deep Scraping & Data Ingestion).
Gathers large datasets of videos, channels, outliers, and metadata into SQLite.
"""

import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from services.youtube_service import YouTubeService
from services.db_service import DatabaseService


class HarvesterService:
    def __init__(self, yt_service: YouTubeService, db_service: Optional[DatabaseService] = None):
        self.yt = yt_service
        self.db = db_service or DatabaseService()

    def harvest_niche_data(
        self,
        niche: str,
        limit: int = 50,
        extract_subtitles_sample: bool = False
    ) -> Dict[str, Any]:
        """
        Executes an on-demand deep harvest for a given niche topic,
        enriching metrics and indexing all discovered channels and videos in SQLite.
        """
        niche_clean = (niche or "").strip()
        if not niche_clean:
            raise ValueError("Укажите тему или нишу для сбора данных")

        start_time = time.time()

        # Generate smart related search variations for comprehensive depth
        search_queries = [niche_clean]
        if "ии" in niche_clean.lower() or "ai" in niche_clean.lower():
            if "агент" in niche_clean.lower():
                search_queries += ["AI agents 2024", "Автономные ИИ агенты", "AI agent workflows"]
            elif "аватар" in niche_clean.lower() or "истори" in niche_clean.lower():
                search_queries += ["AI avatar stories shorts", "AI короткие истории", "нейросети аватары"]
        elif "asmr" in niche_clean.lower():
            search_queries += ["ASMR roleplay", "ASMR triggers relaxation", "ASMR whispering"]

        collected_videos: List[Dict[str, Any]] = []
        seen_vid_ids = set()
        channels_map: Dict[str, Dict[str, Any]] = {}

        # 1. Gather raw videos across variations
        per_query_limit = max(int(limit / len(search_queries)), 15)
        for q in search_queries:
            raw = self.yt.search_videos_rich(q, max_results=per_query_limit)
            for v in raw:
                vid_id = v.get('id')
                if vid_id and vid_id not in seen_vid_ids:
                    seen_vid_ids.add(vid_id)
                    collected_videos.append(v)
            if len(collected_videos) >= limit * 1.5:
                break

        # 2. Extract and index channels
        channel_ids = list(set([v.get('channel_id') for v in collected_videos if v.get('channel_id')]))
        for ch_id in channel_ids[:25]:
            try:
                ch_overview = self.yt.get_channel_overview(ch_id)
                if ch_overview:
                    channels_map[ch_id] = ch_overview
                    self.db.record_channel_snapshot(ch_overview)
            except Exception:
                continue

        # 3. Enrich videos with channel benchmarks & outlier multipliers
        enriched_videos: List[Dict[str, Any]] = []
        outliers_count = 0
        now = datetime.now(timezone.utc)

        for v in collected_videos:
            ch_id = v.get('channel_id')
            ch_data = channels_map.get(ch_id) or {}
            subs = ch_data.get('subscribers', 0)
            views = v.get('views', 0)

            total_vids = max(ch_data.get('video_count', 1), 1)
            total_views = ch_data.get('total_views', 0)
            avg_views = total_views / total_vids if total_views > 0 else max(views, 500)
            baseline = max(avg_views * 0.6, subs * 0.08, 300)
            multiplier = round(views / baseline, 1)

            published_str = v.get('published_at', '')
            try:
                pub_dt = datetime.fromisoformat(published_str.replace('Z', '+00:00'))
                hours_live = max((now - pub_dt).total_seconds() / 3600.0, 1.0)
            except Exception:
                hours_live = 24.0

            vph = int(views / hours_live)
            er = v.get('engagement_rate', 0.0) or v.get('er', 0.0)
            ctr_est = v.get('ctr_estimated', 5.8)

            is_outlier = multiplier >= 2.0
            if is_outlier:
                outliers_count += 1

            v_entry = {
                "id": v.get('id'),
                "title": v.get('title'),
                "thumbnail": v.get('thumbnail'),
                "published_at": published_str,
                "duration_formatted": v.get('duration_formatted', '10:00'),
                "views": views,
                "likes": v.get('likes', 0),
                "comments": v.get('comments', 0),
                "vph": vph,
                "engagement_rate": er,
                "ctr_estimated": ctr_est,
                "channel_id": ch_id,
                "channel_title": v.get('channel_title') or ch_data.get('title', 'Unknown'),
                "channel_subscribers": subs,
                "multiplier": multiplier,
                "is_outlier": is_outlier,
                "tags": v.get('tags', [])
            }

            # Save to persistent SQLite vault
            self.db.save_cached_video(v_entry)
            enriched_videos.append(v_entry)

        # Sort by multiplier (highest viral breakout first)
        enriched_videos.sort(key=lambda x: (x.get('multiplier', 1.0), x.get('views', 0)), reverse=True)

        elapsed_sec = round(time.time() - start_time, 2)
        vault_stats = self.db.get_database_vault_stats()

        return {
            "status": "success",
            "niche": niche_clean,
            "elapsed_seconds": elapsed_sec,
            "videos_harvested": len(enriched_videos),
            "channels_discovered": len(channels_map),
            "outliers_found": outliers_count,
            "top_videos": enriched_videos[:15],
            "vault_stats": vault_stats
        }

import asyncio

DEFAULT_HARVEST_NICHES = ["ИИ агенты", "ASMR", "ИИ аватары с историями"]

class HarvesterScheduler:
    """
    Background scheduler that runs automatic nightly/periodic harvest passes
    across core niches and saves them into the SQLite vault.
    """
    def __init__(self, harvester: HarvesterService):
        self.harvester = harvester
        self.db = harvester.db
        self.is_running = False
        self._task = None

    def start(self):
        """Starts the background loop if not already running"""
        if self.is_running:
            return
        self.is_running = True
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                self._task = loop.create_task(self._loop())
        except Exception as e:
            print(f"Scheduler start note: {e}")

    async def _loop(self):
        """Checks every 60 seconds if scheduled pass is due"""
        while self.is_running:
            try:
                settings = self.db.get_harvester_settings()
                if settings.get('enabled') == 1:
                    now_ts = int(time.time())
                    next_run = settings.get('next_run', 0)
                    if next_run == 0 or now_ts >= next_run:
                        print(f"⏰ [Harvester Cron] Starting scheduled niche harvest pass...")
                        total_harvested = 0
                        for niche in DEFAULT_HARVEST_NICHES:
                            try:
                                res = self.harvester.harvest_niche_data(niche=niche, limit=20)
                                total_harvested += res.get('videos_harvested', 0)
                            except Exception as ne:
                                print(f"Error harvesting {niche}: {ne}")
                        self.db.record_harvester_run(total_harvested)
                        print(f"✅ [Harvester Cron] Finished pass: +{total_harvested} videos indexed in vault.")
            except Exception as e:
                print(f"Harvester scheduler loop exception: {e}")
            await asyncio.sleep(60)

    def trigger_now(self) -> Dict[str, Any]:
        """Triggers an immediate pass synchronously or in background"""
        total_harvested = 0
        for niche in DEFAULT_HARVEST_NICHES:
            try:
                res = self.harvester.harvest_niche_data(niche=niche, limit=20)
                total_harvested += res.get('videos_harvested', 0)
            except Exception as ne:
                print(f"Error harvesting {niche}: {ne}")
        self.db.record_harvester_run(total_harvested)
        return {
            "status": "success",
            "videos_harvested": total_harvested,
            "niches": DEFAULT_HARVEST_NICHES
        }

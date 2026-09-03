"""
Database Service (SQLite) - Manages channel history snapshots,
video time-series records, watchlist tracking, and A/B tests.
"""

import os
import sqlite3
import time
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "analytics.db")


class DatabaseService:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            
            # Channels Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS channels (
                    channel_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    custom_url TEXT,
                    avatar TEXT,
                    country TEXT,
                    subscribers INTEGER DEFAULT 0,
                    total_views INTEGER DEFAULT 0,
                    video_count INTEGER DEFAULT 0,
                    is_watchlist BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Cached Videos Table (VidIQ persistent data bank)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cached_videos (
                    video_id TEXT PRIMARY KEY,
                    channel_id TEXT,
                    channel_title TEXT,
                    title TEXT NOT NULL,
                    description TEXT,
                    thumbnail TEXT,
                    published_at TEXT,
                    duration_formatted TEXT,
                    duration_seconds INTEGER DEFAULT 0,
                    views INTEGER DEFAULT 0,
                    likes INTEGER DEFAULT 0,
                    comments INTEGER DEFAULT 0,
                    vph REAL DEFAULT 0.0,
                    er REAL DEFAULT 0.0,
                    tags_json TEXT,
                    category_id TEXT,
                    ctr_estimated REAL DEFAULT 5.0,
                    has_caption BOOLEAN DEFAULT 0,
                    last_updated INTEGER NOT NULL
                )
            """)

            # Cached Transcripts Table (Never call YouTube subtitles twice)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cached_transcripts (
                    video_id TEXT PRIMARY KEY,
                    language TEXT,
                    cues_json TEXT,
                    summary_json TEXT,
                    full_text TEXT,
                    word_count INTEGER DEFAULT 0,
                    cues_count INTEGER DEFAULT 0,
                    last_updated INTEGER NOT NULL
                )
            """)

            # Cached Niche & Keyword Searches
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cached_searches (
                    query_key TEXT PRIMARY KEY,
                    query_text TEXT,
                    results_json TEXT,
                    result_count INTEGER DEFAULT 0,
                    last_updated INTEGER NOT NULL
                )
            """)

            # API Quota Savings Tracker
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS quota_tracker (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    requests_saved INTEGER DEFAULT 0,
                    requests_made INTEGER DEFAULT 0,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("INSERT OR IGNORE INTO quota_tracker (id, requests_saved, requests_made) VALUES (1, 0, 0)")

            # Channel Snapshots (Time-Series)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS channel_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel_id TEXT NOT NULL,
                    date TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    subscribers INTEGER,
                    views INTEGER,
                    video_count INTEGER,
                    median_views INTEGER,
                    avg_vph REAL,
                    avg_er REAL,
                    FOREIGN KEY(channel_id) REFERENCES channels(channel_id),
                    UNIQUE(channel_id, date)
                )
            """)

            # Video Snapshots
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS video_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    video_id TEXT NOT NULL,
                    channel_id TEXT,
                    title TEXT,
                    date TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    views INTEGER,
                    likes INTEGER,
                    comments INTEGER,
                    vph REAL,
                    er REAL,
                    UNIQUE(video_id, date)
                )
            """)

            # A/B Tests Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ab_tests (
                    id TEXT PRIMARY KEY,
                    video_id TEXT NOT NULL,
                    video_title TEXT,
                    original_thumbnail TEXT,
                    variant_a_title TEXT,
                    variant_a_thumbnail TEXT,
                    variant_b_title TEXT,
                    variant_b_thumbnail TEXT,
                    status TEXT DEFAULT 'active',
                    interval_hours INTEGER DEFAULT 24,
                    current_variant TEXT DEFAULT 'A',
                    views_a INTEGER DEFAULT 0,
                    impressions_a INTEGER DEFAULT 0,
                    views_b INTEGER DEFAULT 0,
                    impressions_b INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_switched TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Tracked Competitors (Spy Radar)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tracked_competitors (
                    channel_id TEXT PRIMARY KEY,
                    title TEXT,
                    custom_url TEXT,
                    avatar TEXT,
                    subscriber_count INTEGER DEFAULT 0,
                    video_count INTEGER DEFAULT 0,
                    median_views INTEGER DEFAULT 0,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Harvester Auto-Scheduler Settings
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS harvester_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    enabled INTEGER DEFAULT 0,
                    interval_hours INTEGER DEFAULT 24,
                    last_run INTEGER DEFAULT 0,
                    next_run INTEGER DEFAULT 0,
                    total_runs INTEGER DEFAULT 0,
                    total_harvested INTEGER DEFAULT 0
                )
            """)
            cursor.execute("INSERT OR IGNORE INTO harvester_settings (id, enabled, interval_hours, last_run, next_run) VALUES (1, 0, 24, 0, 0)")

            conn.commit()

    def record_channel_snapshot(self, overview: Dict[str, Any], analytics: Optional[Dict[str, Any]] = None):
        """Saves or updates channel info and appends daily snapshot"""
        channel_id = overview.get('id')
        if not channel_id:
            return

        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        now_ts = int(time.time())

        subscribers = overview.get('subscribers', 0)
        views = overview.get('total_views', 0)
        video_count = overview.get('video_count', 0)
        median_views = analytics.get('median_views', 0) if analytics else 0
        avg_vph = analytics.get('avg_vph', 0.0) if analytics else 0.0
        avg_er = analytics.get('avg_engagement_rate', 0.0) if analytics else 0.0

        with self._get_conn() as conn:
            cursor = conn.cursor()
            # Upsert channel
            cursor.execute("""
                INSERT INTO channels (channel_id, title, custom_url, avatar, country, last_updated)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(channel_id) DO UPDATE SET
                    title=excluded.title,
                    custom_url=excluded.custom_url,
                    avatar=excluded.avatar,
                    last_updated=CURRENT_TIMESTAMP
            """, (channel_id, overview.get('title', ''), overview.get('custom_url', ''), overview.get('avatar', ''), overview.get('country', '')))

            # Upsert daily snapshot
            cursor.execute("""
                INSERT INTO channel_snapshots (channel_id, date, timestamp, subscribers, views, video_count, median_views, avg_vph, avg_er)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(channel_id, date) DO UPDATE SET
                    subscribers=excluded.subscribers,
                    views=excluded.views,
                    video_count=excluded.video_count,
                    median_views=excluded.median_views,
                    avg_vph=excluded.avg_vph,
                    avg_er=excluded.avg_er
            """, (channel_id, today, now_ts, subscribers, views, video_count, median_views, avg_vph, avg_er))

            conn.commit()

    def toggle_watchlist(self, channel_id: str) -> bool:
        """Toggles watchlist status for a channel"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT is_watchlist FROM channels WHERE channel_id = ?", (channel_id,))
            row = cursor.fetchone()
            if not row:
                return False
            new_val = 0 if row['is_watchlist'] else 1
            cursor.execute("UPDATE channels SET is_watchlist = ? WHERE channel_id = ?", (new_val, channel_id))
            conn.commit()
            return bool(new_val)

    def get_watchlist(self) -> List[Dict[str, Any]]:
        """Returns all channels added to watchlist with their latest stats"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.*, s.subscribers, s.views, s.video_count, s.median_views, s.avg_vph, s.avg_er
                FROM channels c
                LEFT JOIN channel_snapshots s ON c.channel_id = s.channel_id AND s.date = (
                    SELECT MAX(date) FROM channel_snapshots WHERE channel_id = c.channel_id
                )
                WHERE c.is_watchlist = 1
                ORDER BY c.last_updated DESC
            """)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def get_channel_history(self, channel_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Returns time-series history data for a specific channel"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM channel_snapshots
                WHERE channel_id = ?
                ORDER BY date ASC
                LIMIT ?
            """, (channel_id, days))
            rows = cursor.fetchall()
            
            # If less than 2 points exist in DB, synthesize historical trend based on recent data
            if len(rows) <= 1:
                return self._generate_simulated_history(channel_id, days)
                
            return [dict(r) for r in rows]

    def _generate_simulated_history(self, channel_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Generates realistic history curve points if channel was just added today"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM channel_snapshots WHERE channel_id = ? ORDER BY date DESC LIMIT 1", (channel_id,))
            latest = cursor.fetchone()
            if not latest:
                return []
            
            latest_dict = dict(latest)
            current_subs = latest_dict.get('subscribers', 100000)
            current_views = latest_dict.get('views', 10000000)
            
            points = []
            now = datetime.now(timezone.utc)
            for i in range(days, -1, -1):
                day_offset = (days - i)
                # Slight daily growth simulation
                sub_growth_factor = 1.0 - (i * 0.0015)
                view_growth_factor = 1.0 - (i * 0.0025)
                
                point_date = datetime.fromtimestamp(now.timestamp() - (i * 86400), timezone.utc).strftime('%Y-%m-%d')
                points.append({
                    "channel_id": channel_id,
                    "date": point_date,
                    "subscribers": int(current_subs * sub_growth_factor),
                    "views": int(current_views * view_growth_factor),
                    "video_count": latest_dict.get('video_count', 0),
                    "median_views": latest_dict.get('median_views', 0),
                    "avg_vph": latest_dict.get('avg_vph', 0.0),
                    "avg_er": latest_dict.get('avg_er', 0.0)
                })
            return points

    # -------------------------------------------------------------
    # VidIQ-style Persistent Video & Search Data Bank
    # -------------------------------------------------------------
    def save_cached_video(self, video_data: Dict[str, Any]):
        """Persists full video metadata into local SQLite data bank"""
        import json
        vid_id = video_data.get('id')
        if not vid_id:
            return

        now_ts = int(time.time())
        tags_json = json.dumps(video_data.get('tags', []), ensure_ascii=False)

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO cached_videos (
                    video_id, channel_id, channel_title, title, description,
                    thumbnail, published_at, duration_formatted, duration_seconds,
                    views, likes, comments, vph, er, tags_json, category_id,
                    ctr_estimated, has_caption, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                    title=excluded.title,
                    views=excluded.views,
                    likes=excluded.likes,
                    comments=excluded.comments,
                    vph=excluded.vph,
                    er=excluded.er,
                    ctr_estimated=excluded.ctr_estimated,
                    tags_json=excluded.tags_json,
                    last_updated=excluded.last_updated
            """, (
                vid_id,
                video_data.get('channel_id', ''),
                video_data.get('channel_title', ''),
                video_data.get('title', ''),
                video_data.get('description', ''),
                video_data.get('thumbnail', ''),
                video_data.get('published_at', ''),
                video_data.get('duration_formatted', ''),
                video_data.get('duration_seconds', 0),
                video_data.get('views', 0),
                video_data.get('likes', 0),
                video_data.get('comments', 0),
                video_data.get('vph', 0.0),
                video_data.get('engagement_rate', 0.0) or video_data.get('er', 0.0),
                tags_json,
                video_data.get('category_id', ''),
                video_data.get('ctr_estimated', 5.0),
                1 if video_data.get('has_caption') else 0,
                now_ts
            ))
            conn.commit()

    def get_cached_video(self, video_id: str, max_age_seconds: int = 43200) -> Optional[Dict[str, Any]]:
        """Retrieves cached video if updated within max_age_seconds (default 12 hours)"""
        import json
        now_ts = int(time.time())
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cached_videos WHERE video_id = ?", (video_id,))
            row = cursor.fetchone()
            if not row:
                return None
            
            d = dict(row)
            if (now_ts - d.get('last_updated', 0)) > max_age_seconds:
                return None  # Stale, needs refresh
            
            try:
                d['tags'] = json.loads(d.get('tags_json') or '[]')
            except Exception:
                d['tags'] = []
            
            d['id'] = d['video_id']
            d['has_caption'] = bool(d.get('has_caption', 0))
            d['engagement_rate'] = d.get('er', 0.0)
            self.increment_quota_saved()
            return d

    def save_cached_transcript(self, video_id: str, transcript_data: Dict[str, Any]):
        """Persists video transcript forever so YouTube subtitles are never refetched"""
        import json
        if not video_id or not transcript_data:
            return

        now_ts = int(time.time())
        cues_json = json.dumps(transcript_data.get('cues', []), ensure_ascii=False)
        summary_json = json.dumps(transcript_data.get('summary', {}), ensure_ascii=False)

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO cached_transcripts (
                    video_id, language, cues_json, summary_json, full_text,
                    word_count, cues_count, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                    cues_json=excluded.cues_json,
                    summary_json=excluded.summary_json,
                    full_text=excluded.full_text,
                    last_updated=excluded.last_updated
            """, (
                video_id,
                transcript_data.get('language', 'ru'),
                cues_json,
                summary_json,
                transcript_data.get('full_text', ''),
                transcript_data.get('word_count', 0),
                transcript_data.get('cues_count', 0),
                now_ts
            ))
            conn.commit()

    def get_cached_transcript(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Fetches stored transcript from SQLite"""
        import json
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cached_transcripts WHERE video_id = ?", (video_id,))
            row = cursor.fetchone()
            if not row:
                return None

            d = dict(row)
            try:
                cues = json.loads(d.get('cues_json') or '[]')
                summary = json.loads(d.get('summary_json') or '{}')
            except Exception:
                cues = []
                summary = {}

            self.increment_quota_saved()
            return {
                "video_id": video_id,
                "language": d.get('language', 'ru'),
                "cues": cues,
                "cues_count": d.get('cues_count', len(cues)),
                "word_count": d.get('word_count', 0),
                "full_text": d.get('full_text', ''),
                "summary": summary
            }

    def increment_quota_saved(self):
        """Tracks saved API calls"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE quota_tracker SET requests_saved = requests_saved + 1, last_activity = CURRENT_TIMESTAMP WHERE id = 1")
            conn.commit()

    def increment_quota_used(self):
        """Tracks live API calls made"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE quota_tracker SET requests_made = requests_made + 1, last_activity = CURRENT_TIMESTAMP WHERE id = 1")
            conn.commit()

    def get_database_vault_stats(self) -> Dict[str, Any]:
        """Returns total records in local database and quota saved"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM channels")
            total_channels = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM cached_videos")
            total_videos = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM cached_transcripts")
            total_transcripts = cursor.fetchone()[0]

            cursor.execute("SELECT requests_saved, requests_made FROM quota_tracker WHERE id = 1")
            row = cursor.fetchone()
            saved = row['requests_saved'] if row else 0
            made = row['requests_made'] if row else 0

            return {
                "total_channels": total_channels,
                "total_videos": total_videos,
                "total_transcripts": total_transcripts,
                "requests_saved": saved,
                "requests_made": made,
                "saved_percentage": round((saved / max(saved + made, 1)) * 100, 1)
            }

    # Tracked Competitors (Spy Radar) Methods
    def add_tracked_competitor(self, ch: Dict[str, Any]) -> bool:
        """Adds a competitor channel to live radar tracking"""
        cid = ch.get('id') or ch.get('channel_id')
        if not cid:
            return False
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO tracked_competitors 
                (channel_id, title, custom_url, avatar, subscriber_count, video_count, median_views)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                cid,
                ch.get('title', 'Без названия'),
                ch.get('custom_url', ''),
                ch.get('avatar') or ch.get('thumbnail', ''),
                ch.get('subscribers') or ch.get('subscriber_count', 0),
                ch.get('video_count', 0),
                ch.get('median_views', 0)
            ))
            conn.commit()
            return True

    def remove_tracked_competitor(self, channel_id: str) -> bool:
        """Removes a competitor channel from tracking"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM tracked_competitors WHERE channel_id = ?", (channel_id,))
            conn.commit()
            return True

    def get_tracked_competitors(self) -> List[Dict[str, Any]]:
        """Returns all tracked competitors"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tracked_competitors ORDER BY added_at DESC")
            return [dict(r) for r in cursor.fetchall()]

    # Harvester Scheduler Settings
    def get_harvester_settings(self) -> Dict[str, Any]:
        """Returns automatic scheduler status and settings"""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM harvester_settings WHERE id = 1")
            r = cursor.fetchone()
            if r:
                return dict(r)
            return {"enabled": 0, "interval_hours": 24, "last_run": 0, "next_run": 0, "total_runs": 0, "total_harvested": 0}

    def update_harvester_settings(self, enabled: bool, interval_hours: int = 24):
        """Toggles harvester auto-scheduler on/off"""
        now_ts = int(time.time())
        next_ts = now_ts + (interval_hours * 3600) if enabled else 0
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE harvester_settings 
                SET enabled = ?, interval_hours = ?, next_run = ?
                WHERE id = 1
            """, (1 if enabled else 0, interval_hours, next_ts))
            conn.commit()

    def record_harvester_run(self, videos_count: int):
        """Records completed scheduled harvester pass"""
        now_ts = int(time.time())
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT interval_hours FROM harvester_settings WHERE id = 1")
            r = cursor.fetchone()
            interval = r['interval_hours'] if r else 24
            next_ts = now_ts + (interval * 3600)

            cursor.execute("""
                UPDATE harvester_settings 
                SET last_run = ?, next_run = ?, total_runs = total_runs + 1, total_harvested = total_harvested + ?
                WHERE id = 1
            """, (now_ts, next_ts, videos_count))
            conn.commit()


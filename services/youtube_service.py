"""
YouTube Data API Service with smart URL resolution, ISO duration parser,
batch fetching, TTL caching to conserve quota, and rich metrics extraction.
"""

import os
import re
import time
import json
import urllib.request
import urllib.parse
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    HAS_GOOGLE_API = True
except ImportError:
    HAS_GOOGLE_API = False
    build = None
    HttpError = Exception


def parse_iso_duration(duration_str: str) -> Tuple[int, str]:
    """
    Parses ISO 8601 duration (e.g. 'PT1H23M45S', 'PT4M12S', 'PT30S', 'P1DT2H')
    Returns: (total_seconds, formatted_string 'HH:MM:SS' or 'MM:SS')
    """
    if not duration_str or duration_str == 'P0D':
        return 0, "0:00"

    pattern = re.compile(
        r'P(?:(?P<days>\d+)D)?(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?)?'
    )
    match = pattern.match(duration_str)
    if not match:
        return 0, "0:00"

    parts = match.groupdict()
    days = int(parts['days'] or 0)
    hours = int(parts['hours'] or 0) + (days * 24)
    minutes = int(parts['minutes'] or 0)
    seconds = int(parts['seconds'] or 0)

    total_seconds = hours * 3600 + minutes * 60 + seconds

    if hours > 0:
        formatted = f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        formatted = f"{minutes}:{seconds:02d}"

    return total_seconds, formatted


class YouTubeService:
    def __init__(self):
        from .db_service import DatabaseService
        self.db = DatabaseService()
        self.api_key = os.getenv('YOUTUBE_API_KEY', '').strip()
        self.youtube = None
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self.cache_ttl = 900  # 15 minutes

        if HAS_GOOGLE_API and self.api_key and self.api_key != 'ваш_ключ_здесь':
            try:
                self.youtube = build('youtube', 'v3', developerKey=self.api_key)
            except Exception as e:
                print(f"Warning: Failed to initialize YouTube API client: {e}")

    def is_api_configured(self) -> bool:
        return bool(self.youtube and self.api_key and self.api_key != 'ваш_ключ_здесь')

    def _get_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            ts, val = self._cache[key]
            if time.time() - ts < self.cache_ttl:
                try:
                    self.db.increment_quota_saved()
                except Exception:
                    pass
                return val
            del self._cache[key]
        return None

    def _set_cache(self, key: str, val: Any):
        self._cache[key] = (time.time(), val)

    def extract_channel_identifier(self, input_str: str) -> Tuple[str, str]:
        """
        Detects type and identifier from user input:
        Types: 'channel_id', 'handle', 'username', 'search'
        """
        input_str = input_str.strip()

        # 1. Handle with or without full URL (e.g. @handle, youtube.com/@handle/videos)
        handle_match = re.search(r'(?:youtube\.com\/)?@([a-zA-Z0-9_\.\-]+)', input_str)
        if handle_match:
            clean_handle = handle_match.group(1).split('/')[0].split('?')[0]
            return 'handle', clean_handle

        # 2. Channel URL with UC... ID
        chan_url_match = re.search(r'youtube\.com\/channel\/([a-zA-Z0-9_\-]+)', input_str)
        if chan_url_match:
            clean_id = chan_url_match.group(1).split('/')[0].split('?')[0]
            return 'channel_id', clean_id

        # 3. Custom /c/ or /user/ URL
        custom_url_match = re.search(r'youtube\.com\/(?:c|user)\/([a-zA-Z0-9_\-]+)', input_str)
        if custom_url_match:
            clean_user = custom_url_match.group(1).split('/')[0].split('?')[0]
            return 'username', clean_user

        # 4. Direct Channel ID (Starts with UC and 24 chars)
        if re.match(r'^UC[a-zA-Z0-9_\-]{22}$', input_str):
            return 'channel_id', input_str

        return 'search', input_str

    def extract_video_id(self, input_str: str) -> Optional[str]:
        """Extracts 11-char video ID from various URL schemes, shorts, live, or raw string"""
        input_str = input_str.strip()

        # Matches /watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID, /v/ID, /live/ID
        match = re.search(r'(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([a-zA-Z0-9_\-]{11})', input_str)
        if match:
            return match.group(1)

        # Raw 11-character video ID
        if re.match(r'^[a-zA-Z0-9_\-]{11}$', input_str):
            return input_str

        return None

    def resolve_channel_id(self, input_str: str) -> Optional[str]:
        """Resolves any handle, URL, or name into a canonical channel ID"""
        cache_key = f"resolve_chan:{input_str}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        if not self.is_api_configured():
            return "UC_x5XG1OV2P6uZZ5FSM9Ttw"  # Demo ID

        id_type, identifier = self.extract_channel_identifier(input_str)

        try:
            if id_type == 'channel_id':
                return identifier

            if id_type == 'handle':
                res = self.youtube.channels().list(part='id', forHandle=identifier).execute()
                if res.get('items'):
                    chan_id = res['items'][0]['id']
                    self._set_cache(cache_key, chan_id)
                    return chan_id

            if id_type == 'username':
                res = self.youtube.channels().list(part='id', forUsername=identifier).execute()
                if res.get('items'):
                    chan_id = res['items'][0]['id']
                    self._set_cache(cache_key, chan_id)
                    return chan_id

            res = self.youtube.search().list(
                part='snippet',
                q=identifier,
                type='channel',
                maxResults=1
            ).execute()

            if res.get('items'):
                chan_id = res['items'][0]['id']['channelId']
                self._set_cache(cache_key, chan_id)
                return chan_id

        except Exception as e:
            print(f"Error resolving channel {input_str}: {e}")

        return None

    def get_channel_overview(self, channel_input: str) -> Dict[str, Any]:
        """Fetches full channel metadata, stats, branding, and uploads playlist ID"""
        channel_id = self.resolve_channel_id(channel_input)
        if not channel_id:
            return self._get_mock_channel_overview(channel_input)

        cache_key = f"chan_overview:{channel_id}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        if not self.is_api_configured():
            return self._get_mock_channel_overview(channel_input)

        try:
            res = self.youtube.channels().list(
                part='snippet,statistics,contentDetails,brandingSettings',
                id=channel_id
            ).execute()

            if not res.get('items'):
                raise ValueError(f"Канал {channel_id} не найден в YouTube")

            item = res['items'][0]
            snippet = item.get('snippet', {})
            stats = item.get('statistics', {})
            content = item.get('contentDetails', {})
            branding = item.get('brandingSettings', {})

            sub_count = int(stats.get('subscriberCount', 0))
            view_count = int(stats.get('viewCount', 0))
            video_count = int(stats.get('videoCount', 0))
            avg_views = int(view_count / max(video_count, 1))
            uploads_id = content.get('relatedPlaylists', {}).get('uploads', '')
            banner_url = branding.get('image', {}).get('bannerExternalUrl', '')

            data = {
                "id": channel_id,
                "title": snippet.get('title', 'Без названия'),
                "custom_url": snippet.get('customUrl', ''),
                "description": snippet.get('description', ''),
                "published_at": snippet.get('publishedAt', ''),
                "avatar": snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                "banner": banner_url,
                "country": snippet.get('country', 'N/A'),
                "subscribers": sub_count,
                "total_views": view_count,
                "video_count": video_count,
                "avg_views_per_video": avg_views,
                "uploads_playlist_id": uploads_id,
                "keywords": branding.get('channel', {}).get('keywords', '')
            }

            self._set_cache(cache_key, data)
            return data

        except Exception as e:
            print(f"YouTube API error: {e}")
            return self._get_mock_channel_overview(channel_input)

    def get_channel_videos_rich(self, channel_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        """Fetches up to `limit` latest videos from channel with full statistics & duration"""
        cache_key = f"chan_videos:{channel_id}:{limit}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        if not self.is_api_configured():
            return self._get_mock_channel_videos(channel_id, limit)

        try:
            overview = self.get_channel_overview(channel_id)
            uploads_id = overview.get('uploads_playlist_id')
            if not uploads_id:
                return []

            playlist_res = self.youtube.playlistItems().list(
                part='snippet,contentDetails',
                playlistId=uploads_id,
                maxResults=min(limit, 50)
            ).execute()

            items = playlist_res.get('items', [])
            if not items:
                return []

            video_ids = [item['contentDetails']['videoId'] for item in items if 'contentDetails' in item]

            videos_res = self.youtube.videos().list(
                part='snippet,statistics,contentDetails',
                id=','.join(video_ids)
            ).execute()

            video_map = {v['id']: v for v in videos_res.get('items', [])}
            now = datetime.now(timezone.utc)
            rich_videos = []

            for item in items:
                vid_id = item['contentDetails']['videoId']
                raw_vid = video_map.get(vid_id)
                if not raw_vid:
                    continue

                v_snippet = raw_vid.get('snippet', {})
                v_stats = raw_vid.get('statistics', {})
                v_content = raw_vid.get('contentDetails', {})

                views = int(v_stats.get('viewCount', 0))
                likes = int(v_stats.get('likeCount', 0))
                comments = int(v_stats.get('commentCount', 0))

                pub_at_str = v_snippet.get('publishedAt', '')
                try:
                    pub_dt = datetime.fromisoformat(pub_at_str.replace('Z', '+00:00'))
                    hours_since_pub = max((now - pub_dt).total_seconds() / 3600.0, 0.1)
                except Exception:
                    hours_since_pub = 1.0

                vph = round(views / hours_since_pub, 1)
                er = round(((likes + comments) / max(views, 1)) * 100.0, 2)
                dur_raw = v_content.get('duration', 'PT0S')
                total_sec, dur_formatted = parse_iso_duration(dur_raw)

                rich_videos.append({
                    "id": vid_id,
                    "title": v_snippet.get('title', ''),
                    "description": v_snippet.get('description', ''),
                    "published_at": pub_at_str,
                    "thumbnail": v_snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                    "views": views,
                    "likes": likes,
                    "comments": comments,
                    "duration_seconds": total_sec,
                    "duration_formatted": dur_formatted,
                    "vph": vph,
                    "engagement_rate": er,
                    "tags": v_snippet.get('tags', []),
                    "channel_title": v_snippet.get('channelTitle', ''),
                    "channel_id": channel_id,
                    "has_caption": v_content.get('caption', 'false') == 'true'
                })

            self._set_cache(cache_key, rich_videos)
            return rich_videos

        except Exception as e:
            print(f"Error in get_channel_videos_rich: {e}")
            return self._get_mock_channel_videos(channel_id, limit)

    def get_video_deep_details(self, video_input: str) -> Dict[str, Any]:
        """Fetches full metadata for a specific video ID or URL"""
        video_id = self.extract_video_id(video_input)
        if not video_id:
            if not self.is_api_configured():
                return self._get_mock_video_deep_details("dQw4w9WgXcQ")
            raise ValueError(f"Некорректная ссылка или ID видео: {video_input}")

        cache_key = f"vid_deep:{video_id}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        # Check SQLite Persistent Data Bank (0 Quota Spent)
        db_cached = self.db.get_cached_video(video_id)
        if db_cached:
            self._set_cache(cache_key, db_cached)
            return db_cached

        if not self.is_api_configured():
            return self._get_mock_video_deep_details(video_id)

        try:
            res = self.youtube.videos().list(
                part='snippet,statistics,contentDetails',
                id=video_id
            ).execute()

            if not res.get('items'):
                raise ValueError(f"Видео {video_id} не найдено")

            item = res['items'][0]
            snippet = item.get('snippet', {})
            stats = item.get('statistics', {})
            content = item.get('contentDetails', {})

            views = int(stats.get('viewCount', 0))
            likes = int(stats.get('likeCount', 0))
            comments = int(stats.get('commentCount', 0))

            pub_at_str = snippet.get('publishedAt', '')
            now = datetime.now(timezone.utc)
            try:
                pub_dt = datetime.fromisoformat(pub_at_str.replace('Z', '+00:00'))
                hours_since_pub = max((now - pub_dt).total_seconds() / 3600.0, 0.1)
            except Exception:
                hours_since_pub = 1.0

            vph = round(views / hours_since_pub, 1)
            er = round(((likes + comments) / max(views, 1)) * 100.0, 2)
            total_sec, dur_formatted = parse_iso_duration(content.get('duration', 'PT0S'))

            data = {
                "id": video_id,
                "title": snippet.get('title', ''),
                "channel_title": snippet.get('channelTitle', ''),
                "channel_id": snippet.get('channelId', ''),
                "description": snippet.get('description', ''),
                "published_at": pub_at_str,
                "thumbnail": snippet.get('thumbnails', {}).get('maxres', {}).get('url') or snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                "views": views,
                "likes": likes,
                "comments": comments,
                "duration_seconds": total_sec,
                "duration_formatted": dur_formatted,
                "vph": vph,
                "engagement_rate": er,
                "tags": snippet.get('tags', []),
                "category_id": snippet.get('categoryId', ''),
                "has_caption": content.get('caption', 'false') == 'true',
                "licensed_content": content.get('licensedContent', False),
                "dimension": content.get('dimension', '2d'),
                "definition": content.get('definition', 'hd'),
                "ctr_estimated": round(max(min(5.2 + ((er - 3.5) * 0.25) + min(vph / 50.0, 3.5), 14.5), 2.5), 1)
            }

            self.db.save_cached_video(data)
            self.db.increment_quota_used()
            self._set_cache(cache_key, data)
            return data

        except Exception as e:
            print(f"Error fetching video deep details: {e}")
            return self._get_mock_video_deep_details(video_id)

    def search_videos_rich(self, query: str, max_results: int = 15) -> List[Dict[str, Any]]:
        cache_key = f"search_rich:{query}:{max_results}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached

        if not self.is_api_configured():
            return self._get_mock_search_results(query)

        try:
            res = self.youtube.search().list(
                part='snippet',
                q=query,
                type='video',
                maxResults=max_results
            ).execute()

            items = res.get('items', [])
            if not items:
                return []

            video_ids = [it['id']['videoId'] for it in items if 'id' in it and 'videoId' in it['id']]

            vid_res = self.youtube.videos().list(
                part='snippet,statistics,contentDetails',
                id=','.join(video_ids)
            ).execute()

            now = datetime.now(timezone.utc)
            results = []
            for v in vid_res.get('items', []):
                vid_id = v['id']
                v_snip = v.get('snippet', {})
                v_stats = v.get('statistics', {})
                v_cont = v.get('contentDetails', {})

                views = int(v_stats.get('viewCount', 0))
                likes = int(v_stats.get('likeCount', 0))
                comments = int(v_stats.get('commentCount', 0))

                pub_at_str = v_snip.get('publishedAt', '')
                try:
                    pub_dt = datetime.fromisoformat(pub_at_str.replace('Z', '+00:00'))
                    hours_since = max((now - pub_dt).total_seconds() / 3600.0, 0.1)
                except Exception:
                    hours_since = 1.0

                vph = round(views / hours_since, 1)
                er = round(((likes + comments) / max(views, 1)) * 100.0, 2)
                _, dur_fmt = parse_iso_duration(v_cont.get('duration', 'PT0S'))

                results.append({
                    "id": vid_id,
                    "title": v_snip.get('title', ''),
                    "channel_title": v_snip.get('channelTitle', ''),
                    "channel_id": v_snip.get('channelId', ''),
                    "thumbnail": v_snip.get('thumbnails', {}).get('high', {}).get('url', ''),
                    "published_at": pub_at_str,
                    "views": views,
                    "likes": likes,
                    "comments": comments,
                    "vph": vph,
                    "engagement_rate": er,
                    "duration": dur_fmt,
                    "tags": v_snip.get('tags', [])
                })

            self._set_cache(cache_key, results)
            return results

        except Exception as e:
            print(f"Error in search_videos_rich: {e}")
            return self._get_mock_search_results(query)

    # -------------------------------------------------------------
    # Smart Mock Data Generators
    # -------------------------------------------------------------
    def _get_mock_channel_overview(self, query: str) -> Dict[str, Any]:
        return {
            "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
            "title": f"Demo Creator Studio ({query or 'Veritasium'})",
            "custom_url": "@democreator",
            "description": "Демонстрационный профиль канала со всеми метриками vidIQ Growth Studio. Анализ видео, проверка SEO-показателей и аудит виральности.",
            "published_at": "2019-04-12T14:30:00Z",
            "avatar": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
            "banner": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
            "country": "US",
            "subscribers": 1450000,
            "total_views": 320000000,
            "video_count": 284,
            "avg_views_per_video": 1126760,
            "uploads_playlist_id": "UU_x5XG1OV2P6uZZ5FSM9Ttw",
            "keywords": "science physics education entertainment documentaries"
        }

    def _get_mock_channel_videos(self, channel_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        titles = [
            ("How Quantum Computers Actually Break Encryption", 4850000, 240000, 14200, "2024-03-01T15:00:00Z", 940, "15:40", ["quantum", "computers", "cryptography", "future tech"]),
            ("The Bizarre Paradox That Physicists Cant Solve", 8900000, 520000, 31000, "2024-02-14T17:00:00Z", 1240, "20:40", ["physics", "paradox", "space", "science documentary"]),
            ("Why Modern Airplanes Never Fly In Straight Lines", 1250000, 68000, 4200, "2024-01-28T12:00:00Z", 820, "13:40", ["aviation", "airplanes", "navigation", "earth"]),
            ("I Spent 30 Days Testing AI Video Generators", 3200000, 180000, 11500, "2024-01-10T16:30:00Z", 745, "12:25", ["ai", "video generation", "artificial intelligence", "tech review"]),
            ("The Untold Engineering Feat of Burj Khalifa", 940000, 43000, 2800, "2023-12-20T14:00:00Z", 1120, "18:40", ["engineering", "architecture", "megastructures", "dubai"]),
            ("What Really Happens If You Drink Liquid Nitrogen?", 6100000, 340000, 18900, "2023-11-15T18:00:00Z", 610, "10:10", ["experiments", "liquid nitrogen", "chemistry", "extreme science"])
        ]
        
        videos = []
        for i, (t, v, l, c, pub, dur_s, dur_fmt, tags) in enumerate(titles):
            hours = max(24 * (i + 1) * 3, 1)
            vph = round(v / (hours * 10), 1)
            er = round(((l + c) / v) * 100, 2)
            videos.append({
                "id": f"demo_vid_{i+1}",
                "title": t,
                "description": f"Detailed deep dive into {t}. Watch to discover how it works and what the future holds.\n\nTimestamps:\n0:00 Intro\n2:30 Key Concept\n7:15 Deep Analysis\n12:00 Conclusion\n\n#science #tech",
                "published_at": pub,
                "thumbnail": f"https://images.unsplash.com/photo-{1500000000000 + i * 10000}?w=600&auto=format&fit=crop&q=80",
                "views": v,
                "likes": l,
                "comments": c,
                "duration_seconds": dur_s,
                "duration_formatted": dur_fmt,
                "vph": vph,
                "engagement_rate": er,
                "tags": tags,
                "channel_title": "Demo Creator Studio",
                "channel_id": channel_id,
                "has_caption": True
            })
        return videos

    def _get_mock_video_deep_details(self, video_id: str) -> Dict[str, Any]:
        return {
            "id": video_id or "demo_vid_featured",
            "title": "The Bizarre Paradox That Physicists Can't Solve (Yet)",
            "channel_title": "Veritasium Pro",
            "channel_id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
            "description": "An in-depth investigation into one of the most stubborn paradoxes in modern quantum physics.\n\n🔔 Subscribe for weekly science investigations: https://youtube.com/@example\n\nTimestamps:\n0:00 - The Mystery\n02:15 - The First Experiment\n06:40 - Why Einstein Was Skeptical\n11:20 - Modern Quantum Interpretations\n16:50 - Final Thoughts\n\nFollow us on X: https://x.com/example\nOur equipment & tools: https://example.com/gear\n\n#physics #science #quantum #veritasium",
            "published_at": "2024-02-14T17:00:00Z",
            "thumbnail": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
            "views": 8940250,
            "likes": 524100,
            "comments": 31400,
            "duration_seconds": 1240,
            "duration_formatted": "20:40",
            "vph": 482.5,
            "engagement_rate": 6.21,
            "tags": ["physics", "quantum mechanics", "einstein", "paradox", "science documentary", "quantum physics explained", "relativity", "quantum entanglement", "space and time"],
            "category_id": "28",
            "has_caption": True,
            "licensed_content": True,
            "dimension": "2d",
            "definition": "hd"
        }

    def _get_mock_search_results(self, query: str) -> List[Dict[str, Any]]:
        return [
            {
                "id": "mock_res_1",
                "title": f"Complete Guide to {query.title()} in 2024 (Step-by-Step)",
                "channel_title": "Tech Academy",
                "channel_id": "UC_mock_1",
                "thumbnail": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
                "published_at": "2024-01-15T12:00:00Z",
                "views": 480000,
                "likes": 29000,
                "comments": 1400,
                "vph": 110.5,
                "engagement_rate": 6.33,
                "duration": "18:22",
                "tags": [query.lower(), f"{query.lower()} tutorial", "step by step", "guide 2024"]
            },
            {
                "id": "mock_res_2",
                "title": f"Why Everyone Is Wrong About {query.title()}",
                "channel_title": "Insight Daily",
                "channel_id": "UC_mock_2",
                "thumbnail": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80",
                "published_at": "2024-02-01T18:00:00Z",
                "views": 1250000,
                "likes": 84000,
                "comments": 5200,
                "vph": 340.2,
                "engagement_rate": 7.13,
                "duration": "12:45",
                "tags": [query.lower(), "analysis", "case study", "deep dive"]
            }
        ]

    def get_video_comments(self, video_id_or_url: str, max_results: int = 100) -> List[Dict[str, Any]]:
        """
        Fetches top comments for a given video via YouTube Data API commentThreads.
        Extracts author, text, likes, and published timestamp.
        """
        video_id = self.extract_video_id(video_id_or_url)
        if not video_id:
            video_id = video_id_or_url.strip()

        if not self.is_api_configured():
            return [
                {"author": "Viewer1", "text": "Очень крутой ролик, но хотелось бы подробнее про практическое применение!", "likes": 42, "published_at": "2024-01-15"},
                {"author": "CreatorFan", "text": "А как это повторить новичку без бюджета? Сделай видео-инструкцию!", "likes": 31, "published_at": "2024-01-16"},
                {"author": "TechGeek", "text": "В моменте на 04:30 не совсем согласен, сейчас это работает иначе.", "likes": 18, "published_at": "2024-01-18"}
            ]

        try:
            res = self.youtube.commentThreads().list(
                part='snippet',
                videoId=video_id,
                maxResults=min(max_results, 100),
                order='relevance',
                textFormat='plainText'
            ).execute()

            items = res.get('items', [])
            comments = []
            for item in items:
                top = item.get('snippet', {}).get('topLevelComment', {}).get('snippet', {})
                if top:
                    text = top.get('textDisplay') or top.get('textOriginal', '')
                    if text:
                        comments.append({
                            "author": top.get('authorDisplayName', 'Аноним'),
                            "author_avatar": top.get('authorProfileImageUrl', ''),
                            "text": text.strip(),
                            "likes": int(top.get('likeCount', 0)),
                            "published_at": top.get('publishedAt', '')[:10]
                        })
            return comments
        except Exception as e:
            print(f"Note: Error fetching comments for {video_id}: {e}")
            return []


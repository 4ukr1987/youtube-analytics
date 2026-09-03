"""
YouTube Analytics API модуль (Legacy Compatibility Layer)
Получение статистики YouTube-каналов и видео с исправленным парсингом длительности.
Для полноценной веб-версии используйте `services/` и запуск `python main.py`.
"""

import os
import re
from typing import Tuple, List, Dict, Any
from dotenv import load_dotenv
from googleapiclient.discovery import build

load_dotenv()


def parse_iso_duration(duration_str: str) -> Tuple[int, str]:
    """Парсинг ISO 8601 длительности (PT1H23M45S, PT30S, PT1H)"""
    if not duration_str:
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


class YouTubeAnalytics:
    """Класс для получения данных YouTube Analytics"""

    def __init__(self):
        self.api_key = os.getenv('YOUTUBE_API_KEY')
        if not self.api_key or self.api_key == 'ваш_ключ_здесь':
            raise ValueError("YOUTUBE_API_KEY не найден или не настроен в .env файле")
        
        self.youtube = build('youtube', 'v3', developerKey=self.api_key)

    def get_channel_info(self, channel_id: str) -> dict:
        request = self.youtube.channels().list(
            part='snippet,statistics,contentDetails',
            id=channel_id
        )
        response = request.execute()

        if not response.get('items'):
            return {"error": "Канал не найден"}

        channel = response['items'][0]
        snippet = channel['snippet']
        statistics = channel['statistics']

        return {
            "название": snippet['title'],
            "описание": snippet['description'][:200] + "...",
            "подписчики": int(statistics.get('subscriberCount', 0)),
            "просмотры": int(statistics.get('viewCount', 0)),
            "количество_видео": int(statistics.get('videoCount', 0)),
            "дата_создания": snippet['publishedAt'],
            "аватар": snippet['thumbnails']['high']['url']
        }

    def search_channel(self, query: str, max_results: int = 5) -> list:
        request = self.youtube.search().list(
            part='snippet',
            q=query,
            type='channel',
            maxResults=max_results
        )
        response = request.execute()

        channels = []
        for item in response.get('items', []):
            channels.append({
                "id": item['id']['channelId'],
                "название": item['snippet']['title'],
                "описание": item['snippet']['description'][:100] + "...",
                "дата_публикации": item['snippet']['publishedAt']
            })

        return channels

    def get_channel_videos(self, channel_id: str, max_results: int = 10) -> list:
        channel_response = self.youtube.channels().list(
            part='contentDetails',
            id=channel_id
        ).execute()

        if not channel_response.get('items'):
            return []

        uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']

        playlist_response = self.youtube.playlistItems().list(
            part='snippet',
            playlistId=uploads_playlist_id,
            maxResults=max_results
        ).execute()

        videos = []
        for item in playlist_response.get('items', []):
            video_id = item['snippet']['resourceId']['videoId']
            videos.append({
                "id": video_id,
                "название": item['snippet']['title'],
                "описание": item['snippet']['description'][:100] + "...",
                "дата_публикации": item['snippet']['publishedAt'],
                "миниатюра": item['snippet']['thumbnails']['high']['url']
            })

        return videos

    def get_video_stats(self, video_id: str) -> dict:
        request = self.youtube.videos().list(
            part='snippet,statistics,contentDetails',
            id=video_id
        )
        response = request.execute()

        if not response.get('items'):
            return {"error": "Видео не найдено"}

        video = response['items'][0]
        snippet = video['snippet']
        statistics = video['statistics']
        content = video['contentDetails']

        _, dur_formatted = parse_iso_duration(content.get('duration', 'PT0S'))

        return {
            "название": snippet['title'],
            "канал": snippet['channelTitle'],
            "описание": snippet['description'][:200] + "...",
            "просмотры": int(statistics.get('viewCount', 0)),
            "лайки": int(statistics.get('likeCount', 0)),
            "комментарии": int(statistics.get('commentCount', 0)),
            "длительность": dur_formatted,
            "дата_публикации": snippet['publishedAt'],
            "теги": snippet.get('tags', [])[:5]
        }

    def get_trending_videos(self, region_code: str = 'RU', max_results: int = 10) -> list:
        request = self.youtube.videos().list(
            part='snippet,statistics',
            chart='mostPopular',
            regionCode=region_code,
            maxResults=max_results
        )
        response = request.execute()

        videos = []
        for item in response.get('items', []):
            videos.append({
                "id": item['id'],
                "название": item['snippet']['title'],
                "канал": item['snippet']['channelTitle'],
                "просмотры": int(item['statistics'].get('viewCount', 0)),
                "лайки": int(item['statistics'].get('likeCount', 0))
            })

        return videos

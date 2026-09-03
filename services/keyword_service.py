"""
Keyword Research Lab - YouTube Search Autocomplete, Search Volume Estimator,
Competition Difficulty Score, and Long-Tail Keyword Discovery.
"""

import json
import re
import urllib.request
import urllib.parse
from typing import Dict, List, Any
from .youtube_service import YouTubeService


class KeywordService:
    def __init__(self, yt_service: YouTubeService):
        self.yt_service = yt_service

    def get_youtube_suggestions(self, query: str) -> List[str]:
        """Fetches real-time YouTube search autocomplete suggestions (unmetered)"""
        if not query:
            return []

        try:
            encoded_query = urllib.parse.quote(query)
            url = f"https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q={encoded_query}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=4) as response:
                content = response.read().decode('utf-8', errors='ignore')
                match = re.search(r'\[.*\]', content)
                if match:
                    data = json.loads(match.group(0))
                    if len(data) >= 2 and isinstance(data[1], list):
                        return [item[0] for item in data[1] if isinstance(item, list) and item]
        except Exception as e:
            print(f"Error fetching YouTube suggestions: {e}")

        # Fallback generated variations
        return [
            query,
            f"{query} tutorial",
            f"how to {query}",
            f"{query} 2024",
            f"best {query} for beginners",
            f"{query} review",
            f"{query} vs",
            f"{query} step by step"
        ]

    def analyze_keyword(self, query: str) -> Dict[str, Any]:
        query = query.strip().lower()
        if not query:
            raise ValueError("Введите ключевое слово")

        suggestions = self.get_youtube_suggestions(query)
        question_suggestions = self.get_youtube_suggestions(f"how to {query}")
        why_suggestions = self.get_youtube_suggestions(f"why {query}")

        all_related = list(dict.fromkeys(suggestions + question_suggestions + why_suggestions))
        top_videos = self.yt_service.search_videos_rich(query, max_results=10)

        if top_videos:
            avg_views = sum(v.get('views', 0) for v in top_videos) / len(top_videos)
            avg_vph = sum(v.get('vph', 0) for v in top_videos) / len(top_videos)

            if avg_views > 2000000 or avg_vph > 500:
                competition_score = 85
                competition_label = "Очень высокая"
            elif avg_views > 500000 or avg_vph > 150:
                competition_score = 65
                competition_label = "Высокая"
            elif avg_views > 100000 or avg_vph > 50:
                competition_score = 45
                competition_label = "Средняя"
            else:
                competition_score = 25
                competition_label = "Низкая"
        else:
            competition_score = 40
            competition_label = "Средняя"

        words_count = len(query.split())
        base_volume = max(90 - (words_count * 10), 30)
        suggestion_bonus = min(len(suggestions) * 3, 20)
        search_volume = min(max(base_volume + suggestion_bonus, 20), 98)

        if search_volume >= 80:
            volume_label = "Очень высокий"
        elif search_volume >= 60:
            volume_label = "Высокий"
        elif search_volume >= 40:
            volume_label = "Средний"
        else:
            volume_label = "Низкий"

        opportunity_score = int(round((search_volume * 0.55) + ((100 - competition_score) * 0.45)))
        opportunity_score = min(max(opportunity_score, 10), 99)

        if opportunity_score >= 70:
            opp_color = "emerald"
            opp_badge = "🔥 Отличная возможность"
        elif opportunity_score >= 50:
            opp_color = "cyan"
            opp_badge = "⚡ Хороший потенциал"
        elif opportunity_score >= 35:
            opp_color = "amber"
            opp_badge = "⚠️ Высокая конкуренция"
        else:
            opp_color = "rose"
            opp_badge = "❌ Сложная ниша"

        keyword_table = []
        for kw in all_related[:15]:
            kw_len = len(kw.split())
            kw_vol = max(search_volume - (kw_len - words_count) * 6, 25)
            kw_comp = max(competition_score - (kw_len - words_count) * 8, 15)
            kw_opp = int(round((kw_vol * 0.55) + ((100 - kw_comp) * 0.45)))
            keyword_table.append({
                "keyword": kw,
                "volume": kw_vol,
                "competition": kw_comp,
                "opportunity": kw_opp,
                "is_question": any(kw.startswith(q) for q in ["how", "why", "what", "как", "почему", "что"])
            })

        return {
            "query": query,
            "search_volume": search_volume,
            "volume_label": volume_label,
            "competition_score": competition_score,
            "competition_label": competition_label,
            "opportunity_score": opportunity_score,
            "opportunity_badge": opp_badge,
            "opportunity_color": opp_color,
            "related_keywords": keyword_table,
            "top_ranking_videos": top_videos
        }

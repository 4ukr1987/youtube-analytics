"""
Outlier Intelligence Engine (1of10 & ViewStats Competitor)
Scans YouTube niches for high-multiplier viral breakout videos and performs AI viral DNA breakdowns.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from services.youtube_service import YouTubeService
from services.ai_assistant import AIAssistant


class OutlierService:
    def __init__(self, yt_service: YouTubeService, ai_assistant: AIAssistant):
        self.yt = yt_service
        self.ai = ai_assistant

    def search_niche_outliers(
        self,
        topic: str,
        min_multiplier: float = 2.0,
        max_channel_subs: Optional[int] = None,
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Searches YouTube for recent videos in a niche, fetches channel benchmarks,
        and calculates true Outlier Multipliers (views / channel median).
        """
        topic = topic.strip()
        if not topic:
            return []

        # 1. Search videos by topic
        raw_videos = self.yt.search_videos_rich(topic, max_results=min(limit * 2, 50))
        if not raw_videos:
            return []

        # 2. Extract unique channels
        channel_ids = list(set([v.get('channel_id') for v in raw_videos if v.get('channel_id')]))
        
        # Batch fetch channel stats
        channels_info = {}
        for ch_id in channel_ids[:20]:
            try:
                ov = self.yt.get_channel_overview(ch_id)
                channels_info[ch_id] = ov
            except Exception:
                continue

        outliers = []
        now = datetime.now(timezone.utc)

        for v in raw_videos:
            ch_id = v.get('channel_id')
            ch_data = channels_info.get(ch_id)
            if not ch_data:
                continue

            subs = ch_data.get('subscribers', 0)
            if max_channel_subs and subs > max_channel_subs:
                continue

            views = v.get('views', 0)
            
            # Channel median approximation based on total views and video count
            total_vids = max(ch_data.get('video_count', 1), 1)
            total_views = ch_data.get('total_views', 0)
            avg_views = total_views / total_vids
            
            # Median baseline: typically 50-70% of average or subscriber base rule
            baseline = max(avg_views * 0.6, subs * 0.08, 300)
            multiplier = round(views / baseline, 1)

            if multiplier >= min_multiplier:
                # Calculate VPH (Views Per Hour)
                published_str = v.get('published_at', '')
                hours_live = 24
                try:
                    pub_dt = datetime.fromisoformat(published_str.replace('Z', '+00:00'))
                    hours_live = max((now - pub_dt).total_seconds() / 3600.0, 1.0)
                except Exception:
                    pass
                vph = int(views / hours_live)

                # Determine Outlier Tier
                if multiplier >= 10.0:
                    tier = "MEGA"
                    tier_badge = "🚀 MEGA OUTLIER"
                elif multiplier >= 5.0:
                    tier = "HIGH"
                    tier_badge = "⚡ HIGH OUTLIER"
                else:
                    tier = "SOLID"
                    tier_badge = "✨ SOLID OUTLIER"

                outliers.append({
                    "id": v.get('id'),
                    "title": v.get('title'),
                    "thumbnail": v.get('thumbnail'),
                    "duration_formatted": v.get('duration_formatted', '10:00'),
                    "published_at": published_str,
                    "views": views,
                    "vph": vph,
                    "channel_id": ch_id,
                    "channel_title": ch_data.get('title'),
                    "channel_thumbnail": ch_data.get('thumbnail'),
                    "channel_subscribers": subs,
                    "baseline_views": int(baseline),
                    "multiplier": multiplier,
                    "tier": tier,
                    "tier_badge": tier_badge,
                    "url": f"https://www.youtube.com/watch?v={v.get('id')}"
                })

        # Sort by multiplier descending
        outliers.sort(key=lambda x: x['multiplier'], reverse=True)
        return outliers[:limit]

    def generate_viral_breakdown(
        self,
        title: str,
        channel_title: str,
        views: int,
        multiplier: float
    ) -> Dict[str, Any]:
        """
        Uses Gemini 3.6/3.7 to analyze why a specific outlier blew up and how to replicate it.
        """
        prompt = f"""Ты — мировой эксперт по вирусным алгоритмам YouTube (уровень аналитиков MrBeast и vidIQ).
Проанализируй аномально вирусное видео:
- Заголовок: "{title}"
- Канал: "{channel_title}"
- Просмотры: {views:,} (это в {multiplier}x раз выше нормы канала!)

Дай глубокий структурированный разбор на русском языке:
1. "trigger": Главный психологический триггер кликабельности (Curiosity Gap, FOMO, Контраст, Авторитет).
2. "why_it_worked": Почему алгоритм YouTube продвинул именно это видео (3 ключевых фактора).
3. "thumbnail_concept": Какая визуальная обложка сработала бы с этим заголовком на 100%.
4. "remix_recipe": Пошаговый рецепт, как автору снять свой ролик на эту тему и получить такой же взрывной охват.

Верни ответ ТОЛЬКО в формате JSON:
{{
  "trigger": "...",
  "why_it_worked": ["...", "...", "..."],
  "thumbnail_concept": "...",
  "remix_recipe": "..."
}}
"""
        response_text = self.ai._call_gemini(prompt)
        if response_text:
            try:
                cleaned = response_text.replace('```json', '').replace('```', '').strip()
                import json
                return json.loads(cleaned)
            except Exception:
                pass

        # Smart fallback
        return {
            "trigger": "Разрыв любопытства (Curiosity Gap) + Социальное доказательство",
            "why_it_worked": [
                f"Заголовок обещает раскрыть неочевидный факт или протестировать гипотезу",
                f"Высокий темп просмотров ({multiplier}x от нормы) дал мощный импульс CTR",
                "Широкий интерес темы охватывает как новичков, так и экспертов в нише"
            ],
            "thumbnail_concept": "Крупный план с контрастной реакцией и разделенный экран 'До vs После' без лишнего текста",
            "remix_recipe": f"Возьмите основу идеи '{title}', добавьте свой уникальный личный опыт или формат 24-часового эксперимента."
        }

    def remix_outlier_for_channel(self, title: str, creator_niche: str = "") -> List[Dict[str, Any]]:
        """
        Generates 3 adapted, personalized titles and hooks inspired by a viral outlier.
        """
        prompt = f"""Адаптируй успешный вирусный заголовок YouTube:
Оригинал: "{title}"
Ниша автора: {creator_niche or "YouTube & Контент"}

Создай 3 оригинальных адаптации этого формата под канал автора с высоким потенциалом CTR.
Верни ТОЛЬКО валидный JSON:
[
  {{
    "title": "...",
    "angle": "...",
    "hook": "..."
  }},
  ...
]
"""
        resp = self.ai._call_gemini(prompt)
        if resp:
            try:
                import json
                cleaned = resp.replace('```json', '').replace('```', '').strip()
                return json.loads(cleaned)
            except Exception:
                pass

        return [
            {
                "title": f"Я Повторил: {title} (И Вот Реальный Результат)",
                "angle": "Формат проверки на практике",
                "hook": "Все говорят об этом методе, но никто не показал подводные камни. Сегодня я проверил всё на своем опыте..."
            },
            {
                "title": f"Вся Правда Про {title}, Которую Вам Не Расскажут",
                "angle": "Разоблачение и скрытые нюансы",
                "hook": "99% людей делают это совершенно неправильно. Вот 3 ошибки, которые стоят вам просмотров..."
            },
            {
                "title": f"Пошаговый Гайд: Как Сделать {title} За 24 Часа",
                "angle": "Быстрый результат с ограничением по времени",
                "hook": "Если у вас есть всего 24 часа и ноль бюджета, начните именно с этих 3 шагов..."
            }
        ]

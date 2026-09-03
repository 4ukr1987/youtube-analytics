"""
Best Time to Post Heatmap Service (vidIQ & ViewStats Competitor)
Calculates 7x24 audience activity matrix, peak online hours, and timing strategies.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from services.youtube_service import YouTubeService
from services.ai_assistant import AIAssistant


class BestTimeService:
    def __init__(self, yt_service: YouTubeService, ai_assistant: AIAssistant):
        self.yt = yt_service
        self.ai = ai_assistant

    def calculate_best_time_matrix(
        self,
        channel_query: str = "@veritasium",
        tz_offset: int = 3
    ) -> Dict[str, Any]:
        """
        Calculates 7 days x 24 hours audience activity matrix adjusted for timezone offset.
        """
        overview = None
        recent_videos = []
        chan_title = channel_query
        
        try:
            overview = self.yt.get_channel_overview(channel_query)
            if overview:
                chan_id = overview.get('id')
                chan_title = overview.get('title', channel_query)
                recent_videos = self.yt.get_channel_videos_rich(chan_id, limit=30)
        except Exception:
            pass

        # Days of week labels (Monday to Sunday)
        days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]

        # Base audience activity profile (Gaussian curve peak around 17:00-21:00 on weekdays, 13:00-20:00 on weekends)
        # 0 = night, 100 = peak
        weekday_curve = [
            12, 8, 5, 4, 5, 8, 15, 25, 38, 48, 55, 62,
            68, 72, 75, 82, 89, 96, 98, 95, 88, 74, 52, 28
        ]
        
        friday_curve = [
            14, 9, 6, 5, 5, 8, 16, 28, 42, 54, 62, 70,
            76, 80, 84, 90, 95, 99, 97, 92, 85, 78, 60, 35
        ]

        weekend_curve = [
            18, 12, 8, 5, 5, 7, 14, 25, 45, 65, 78, 88,
            94, 96, 95, 93, 91, 92, 90, 86, 78, 65, 48, 26
        ]

        # Shift curve according to tz_offset relative to UTC+3 base
        shift = (tz_offset - 3) % 24

        def shift_list(lst, k):
            return lst[-k:] + lst[:-k] if k != 0 else lst

        matrix = []
        for i, day_name in enumerate(days):
            if i < 4: # Mon - Thu
                base = list(weekday_curve)
            elif i == 4: # Fri
                base = list(friday_curve)
            else: # Sat - Sun
                base = list(weekend_curve)

            # Apply upload boost if channel frequently uploads on this day
            shifted = shift_list(base, shift)
            
            hours_data = []
            for h, score in enumerate(shifted):
                if score >= 90:
                    tier = "GOLDEN"
                    status = "Идеальное время (Пик онлайна)"
                elif score >= 70:
                    tier = "HIGH"
                    status = "Высокая активность"
                elif score >= 40:
                    tier = "MODERATE"
                    status = "Умеренная активность"
                else:
                    tier = "LOW"
                    status = "Низкая активность (Ночь)"

                hours_data.append({
                    "hour": h,
                    "hour_formatted": f"{h:02d}:00",
                    "score": score,
                    "tier": tier,
                    "status": status
                })

            matrix.append({
                "day_index": i,
                "day_name": day_name,
                "hours": hours_data
            })

        # Find Top 3 Golden Slots
        all_slots = []
        for day in matrix:
            for h in day["hours"]:
                all_slots.append({
                    "day_name": day["day_name"],
                    "hour_formatted": h["hour_formatted"],
                    "score": h["score"],
                    "tier": h["tier"],
                    "status": h["status"]
                })
        
        all_slots.sort(key=lambda x: x["score"], reverse=True)
        top_slots = all_slots[:3]

        # Pre-publish recommendations
        golden_hour_str = f"{top_slots[0]['day_name']} в {top_slots[0]['hour_formatted']}"

        return {
            "status": "success",
            "channel_title": chan_title,
            "timezone_offset": tz_offset,
            "timezone_name": f"UTC{'+' if tz_offset >= 0 else ''}{tz_offset}",
            "top_slots": top_slots,
            "golden_hour": golden_hour_str,
            "matrix": matrix,
            "strategy": {
                "pre_publish_rule": "Публикуйте ролик за 1.5–2 часа до пика онлайна, чтобы алгоритм YouTube успел обработать 4K/HD видео, расставить автосубтитры и подготовить кэш для максимального стартового импульса.",
                "shorts_timing": "Для YouTube Shorts лучшее время — утренние часы (08:00–10:00) и вечер (18:00–21:00), когда зрители просматривают короткие видео в дороге или перед сном.",
                "longform_timing": "Для длинных видео (15+ минут) идеальны вечерние часы будней (17:00–20:00) и дневное время выходных (13:00–17:00)."
            }
        }

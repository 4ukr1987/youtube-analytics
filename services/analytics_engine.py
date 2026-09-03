"""
Analytics & Virality Engine - Calculates VPH, Outlier Multipliers,
Channel Baselines, Engagement Dynamics, and Competitor Comparison.
"""

from typing import Dict, List, Any
import statistics
from datetime import datetime


class AnalyticsEngine:
    """Computes virality multipliers, channel baselines, and performance benchmarks"""

    def process_channel_analytics(self, channel_overview: Dict[str, Any], videos: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not videos:
            return {
                "median_views": 0,
                "mean_views": 0,
                "avg_engagement_rate": 0.0,
                "avg_vph": 0.0,
                "total_analyzed": 0,
                "outliers": [],
                "upload_cadence": {},
                "projected_monthly_views": 0
            }

        view_counts = [v.get('views', 0) for v in videos]
        er_rates = [v.get('engagement_rate', 0.0) for v in videos]
        vph_rates = [v.get('vph', 0.0) for v in videos]

        median_views = int(statistics.median(view_counts)) if view_counts else 0
        mean_views = int(statistics.mean(view_counts)) if view_counts else 0
        avg_er = round(statistics.mean(er_rates), 2) if er_rates else 0.0
        avg_vph = round(statistics.mean(vph_rates), 1) if vph_rates else 0.0

        # Calculate Outlier Multiplier for each video
        processed_videos = []
        outliers_count = 0

        for v in videos:
            views = v.get('views', 0)
            multiplier = round(views / max(median_views, 1), 2)

            # Calculate Outlier Multiplier for each video
            if multiplier >= 3.0:
                tier = "🔥 Viral Outlier"
                badge = "viral"
                outliers_count += 1
            elif multiplier >= 1.7:
                tier = "⚡ High Performer"
                badge = "high"
                outliers_count += 1
            elif multiplier >= 0.7:
                tier = "✅ Standard"
                badge = "normal"
            else:
                tier = "📉 Low Performer"
                badge = "low"

            # Benchmark Estimated CTR (YouTube standard: 4-6%, Top performers: 8-12%)
            base_ctr = 5.2
            mult_factor = (multiplier - 1.0) * 1.7
            er_bonus = (v.get('engagement_rate', 0.0) - 3.5) * 0.18
            estimated_ctr = round(max(min(base_ctr + mult_factor + er_bonus, 14.2), 2.1), 1)

            if estimated_ctr >= 7.8:
                ctr_tier = "🔥 Высокий"
                ctr_badge = "viral"
            elif estimated_ctr >= 5.4:
                ctr_tier = "⚡ Отличный"
                ctr_badge = "high"
            elif estimated_ctr >= 3.8:
                ctr_tier = "✅ В норме"
                ctr_badge = "normal"
            else:
                ctr_tier = "📉 Низкий"
                ctr_badge = "low"

            processed_v = {
                **v,
                "outlier_multiplier": multiplier,
                "performance_tier": tier,
                "performance_badge": badge,
                "ctr_estimated": estimated_ctr,
                "ctr_tier": ctr_tier,
                "ctr_badge": ctr_badge
            }
            processed_videos.append(processed_v)

        # Sort videos: by outlier multiplier descending
        outliers_sorted = sorted(processed_videos, key=lambda x: x['outlier_multiplier'], reverse=True)

        # Upload cadence analysis (day of week)
        day_counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}
        day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        for v in videos:
            pub_str = v.get('published_at', '')
            try:
                dt = datetime.fromisoformat(pub_str.replace('Z', '+00:00'))
                day_counts[dt.weekday()] += 1
            except Exception:
                pass

        total_analyzed = len(videos)
        best_day_idx = max(day_counts, key=day_counts.get)
        best_day_name = day_names[best_day_idx]

        # Cadence in days between uploads
        upload_intervals = []
        sorted_by_date = sorted(videos, key=lambda x: x.get('published_at', ''), reverse=True)
        for i in range(len(sorted_by_date) - 1):
            try:
                d1 = datetime.fromisoformat(sorted_by_date[i]['published_at'].replace('Z', '+00:00'))
                d2 = datetime.fromisoformat(sorted_by_date[i+1]['published_at'].replace('Z', '+00:00'))
                days_diff = abs((d1 - d2).total_seconds() / 86400.0)
                upload_intervals.append(days_diff)
            except Exception:
                pass

        avg_days_between = round(statistics.mean(upload_intervals), 1) if upload_intervals else 7.0
        videos_per_month = round(30.0 / max(avg_days_between, 0.5), 1)

        # Projected 30-day view velocity
        projected_monthly_views = int(videos_per_month * median_views)
        videos_per_week = round(videos_per_month / 4.3, 1)
        day_dist = {day_names[k]: day_counts[k] for k in day_counts}

        cadence_dict = {
            "avg_days_between_uploads": avg_days_between,
            "average_days_between_uploads": avg_days_between,
            "videos_per_month": videos_per_month,
            "videos_per_week": videos_per_week,
            "best_publishing_day": best_day_name,
            "day_distribution": day_dist
        }

        return {
            "median_views": median_views,
            "mean_views": mean_views,
            "views_distribution": {
                "median": median_views,
                "mean": mean_views
            },
            "avg_engagement_rate": avg_er,
            "engagement": {
                "average_engagement_rate": avg_er
            },
            "avg_vph": avg_vph,
            "total_analyzed": total_analyzed,
            "outliers_found": outliers_count,
            "outliers": outliers_sorted,
            "recent_videos": processed_videos,
            "videos": processed_videos,
            "top_outliers": outliers_sorted[:10],
            "cadence": cadence_dict,
            "publishing_cadence": cadence_dict,
            "projected_monthly_views": projected_monthly_views
        }

    def compare_channels(self, channel_a: Dict[str, Any], channel_b: Dict[str, Any]) -> Dict[str, Any]:
        """Calculates side-by-side comparative battle metrics between two channels"""
        ov_a = channel_a.get('overview', {})
        ov_b = channel_b.get('overview', {})
        an_a = channel_a.get('analytics', {})
        an_b = channel_b.get('analytics', {})

        metrics = [
            {
                "name": "Подписчики",
                "val_a": ov_a.get('subscribers', 0),
                "val_b": ov_b.get('subscribers', 0),
                "winner": "A" if ov_a.get('subscribers', 0) > ov_b.get('subscribers', 0) else "B"
            },
            {
                "name": "Всего просмотров",
                "val_a": ov_a.get('total_views', 0),
                "val_b": ov_b.get('total_views', 0),
                "winner": "A" if ov_a.get('total_views', 0) > ov_b.get('total_views', 0) else "B"
            },
            {
                "name": "Медианные просмотры на видео",
                "val_a": an_a.get('median_views', 0),
                "val_b": an_b.get('median_views', 0),
                "winner": "A" if an_a.get('median_views', 0) > an_b.get('median_views', 0) else "B"
            },
            {
                "name": "Вовлеченность (ER %)",
                "val_a": an_a.get('avg_engagement_rate', 0.0),
                "val_b": an_b.get('avg_engagement_rate', 0.0),
                "winner": "A" if an_a.get('avg_engagement_rate', 0.0) > an_b.get('avg_engagement_rate', 0.0) else "B"
            },
            {
                "name": "Скорость просмотров (Avg VPH)",
                "val_a": an_a.get('avg_vph', 0.0),
                "val_b": an_b.get('avg_vph', 0.0),
                "winner": "A" if an_a.get('avg_vph', 0.0) > an_b.get('avg_vph', 0.0) else "B"
            },
            {
                "name": "Регулярность (Видео в месяц)",
                "val_a": an_a.get('cadence', {}).get('videos_per_month', 0),
                "val_b": an_b.get('cadence', {}).get('videos_per_month', 0),
                "winner": "A" if an_a.get('cadence', {}).get('videos_per_month', 0) > an_b.get('cadence', {}).get('videos_per_month', 0) else "B"
            }
        ]

        wins_a = sum(1 for m in metrics if m['winner'] == 'A')
        wins_b = sum(1 for m in metrics if m['winner'] == 'B')

        return {
            "channel_a": ov_a,
            "channel_b": ov_b,
            "metrics": metrics,
            "score": {"A": wins_a, "B": wins_b},
            "overall_winner": "A" if wins_a > wins_b else ("B" if wins_b > wins_a else "Tie")
        }

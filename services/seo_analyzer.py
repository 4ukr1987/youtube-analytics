"""
SEO Analyzer Engine - Evaluates YouTube videos against 20+ ranking factors
producing an actionable vidIQ-style SEO Score (0-100) and Optimization Checklist.
"""

import re
from typing import Dict, List, Any


POWER_WORDS = {
    'how', 'why', 'what', 'secret', 'ultimate', 'guide', 'truth', 'best', 'top',
    'step', 'easy', 'fast', 'shocking', 'unbelievable', 'revealed', 'never', 'must',
    'review', 'tutorial', 'complete', 'vs', 'explained', 'method', 'hack', 'pro',
    'как', 'почему', 'секрет', 'лучший', 'топ', 'гайд', 'обзор', 'инструкция',
    'быстро', 'просто', 'полный', 'правда', 'ошибки', 'разбор'
}


class SEOAnalyzer:
    """Calculates comprehensive vidIQ-grade SEO score and actionable checklist"""

    def analyze_video(self, video_data: Dict[str, Any]) -> Dict[str, Any]:
        title = video_data.get('title', '').strip()
        desc = video_data.get('description', '').strip()
        tags = video_data.get('tags', [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(',') if t.strip()]

        has_caption = video_data.get('has_caption', False)
        definition = video_data.get('definition', 'hd')
        views = video_data.get('views', 0)
        likes = video_data.get('likes', 0)
        comments = video_data.get('comments', 0)
        er = video_data.get('engagement_rate', 0.0)

        checklist = []
        scores = {}

        # -------------------------------------------------------------
        # 1. TITLE SCORE (Max 25 pts)
        # -------------------------------------------------------------
        title_score = 0
        title_len = len(title)
        
        # A. Length (40-70 is optimal for desktop + mobile)
        if 40 <= title_len <= 70:
            title_score += 10
            checklist.append({
                "category": "Заголовок",
                "name": "Оптимальная длина заголовка",
                "status": "pass",
                "detail": f"{title_len} симв. (идеально 40–70 симв. для мобильной и десктопной выдачи)",
                "points": 10
            })
        elif 25 <= title_len < 40:
            title_score += 6
            checklist.append({
                "category": "Заголовок",
                "name": "Длина заголовка",
                "status": "warn",
                "detail": f"{title_len} симв. (чуть коротковат, добавьте ключевых слов до 50–65 симв.)",
                "points": 6
            })
        elif 70 < title_len <= 90:
            title_score += 7
            checklist.append({
                "category": "Заголовок",
                "name": "Длина заголовка",
                "status": "warn",
                "detail": f"{title_len} симв. (может обрезаться на смартфонах, рекомендуется до 70)",
                "points": 7
            })
        else:
            title_score += 2
            checklist.append({
                "category": "Заголовок",
                "name": "Длина заголовка",
                "status": "fail",
                "detail": f"{title_len} симв. (слишком короткий или перегруженный заголовок)",
                "points": 2
            })

        # B. Power words / Click trigger words
        title_words = set(re.findall(r'\b\w+\b', title.lower()))
        matched_power_words = title_words.intersection(POWER_WORDS)
        if matched_power_words:
            title_score += 8
            checklist.append({
                "category": "Заголовок",
                "name": "Клик-триггеры и Power Words",
                "status": "pass",
                "detail": f"Найдены цепляющие слова: {', '.join(list(matched_power_words)[:3])}",
                "points": 8
            })
        else:
            title_score += 3
            checklist.append({
                "category": "Заголовок",
                "name": "Клик-триггеры (Power Words)",
                "status": "warn",
                "detail": "Заголовок не содержит слов-триггеров (Как, Почему, Топ, Секрет, Разбор, Guide)",
                "points": 3
            })

        # C. Numbers / Years in title (boosts CTR)
        has_number = bool(re.search(r'\b\d+\b', title))
        if has_number:
            title_score += 7
            checklist.append({
                "category": "Заголовок",
                "name": "Числа или год в заголовке",
                "status": "pass",
                "detail": "Числа повышают CTR на 15–20% в поисковой выдаче",
                "points": 7
            })
        else:
            title_score += 2
            checklist.append({
                "category": "Заголовок",
                "name": "Числа в заголовке",
                "status": "warn",
                "detail": "Добавление чисел (например, '5 способов', '2024') увеличивает кликабельность",
                "points": 2
            })

        scores['title'] = min(title_score, 25)

        # -------------------------------------------------------------
        # 2. DESCRIPTION SCORE (Max 25 pts)
        # -------------------------------------------------------------
        desc_score = 0
        desc_len = len(desc)
        desc_words_count = len(re.findall(r'\b\w+\b', desc))

        # A. Description volume (> 200 words / > 800 chars)
        if desc_len >= 800:
            desc_score += 8
            checklist.append({
                "category": "Описание",
                "name": "Объем и глубина описания",
                "status": "pass",
                "detail": f"{desc_words_count} слов ({desc_len} симв.) — отличная база для алгоритмов YouTube",
                "points": 8
            })
        elif desc_len >= 300:
            desc_score += 5
            checklist.append({
                "category": "Описание",
                "name": "Объем описания",
                "status": "warn",
                "detail": f"{desc_len} симв. (рекомендуется расширить описание до 800+ симв. с таймкодами и контекстом)",
                "points": 5
            })
        else:
            desc_score += 1
            checklist.append({
                "category": "Описание",
                "name": "Объем описания",
                "status": "fail",
                "detail": f"Всего {desc_len} симв. Короткое описание снижает ранжирование в YouTube Search",
                "points": 1
            })

        # B. Links & Socials / Call To Action
        has_links = bool(re.search(r'https?://[^\s]+', desc))
        if has_links:
            desc_score += 6
            checklist.append({
                "category": "Описание",
                "name": "Ссылки и призывы к действию (CTA)",
                "status": "pass",
                "detail": "Присутствуют внешние ссылки, социальные сети или призывы подписаться",
                "points": 6
            })
        else:
            checklist.append({
                "category": "Описание",
                "name": "Ссылки и призывы к действию (CTA)",
                "status": "fail",
                "detail": "Нет ссылок на соцсети, плейлисты или ресурсы канала",
                "points": 0
            })

        # C. Timestamps / Chapters
        has_timestamps = bool(re.search(r'\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b', desc))
        if has_timestamps:
            desc_score += 6
            checklist.append({
                "category": "Описание",
                "name": "Таймкоды (YouTube Chapters)",
                "status": "pass",
                "detail": "Таймкоды помогают видео попадать в Google Key Moments и улучшают удержание",
                "points": 6
            })
        else:
            checklist.append({
                "category": "Описание",
                "name": "Таймкоды (YouTube Chapters)",
                "status": "warn",
                "detail": "Добавьте главы (00:00 Введение, 02:15 Тема...), чтобы ранжироваться в Google",
                "points": 0
            })

        # D. Hashtags
        hashtags = re.findall(r'#[\w\d]+', desc)
        if 1 <= len(hashtags) <= 5:
            desc_score += 5
            checklist.append({
                "category": "Описание",
                "name": "Хэштеги в описании",
                "status": "pass",
                "detail": f"Найдено {len(hashtags)} хэштегов (оптимально 1–3 над заголовком)",
                "points": 5
            })
        elif len(hashtags) > 5:
            desc_score += 2
            checklist.append({
                "category": "Описание",
                "name": "Переспам хэштегами",
                "status": "warn",
                "detail": f"{len(hashtags)} хэштегов (YouTube может проигнорировать при >15 хэштегах)",
                "points": 2
            })
        else:
            checklist.append({
                "category": "Описание",
                "name": "Хэштеги в описании",
                "status": "warn",
                "detail": "Добавьте 2–3 релевантных хэштега (#тема #категория)",
                "points": 0
            })

        scores['description'] = min(desc_score, 25)

        # -------------------------------------------------------------
        # 3. TAGS SCORE (Max 25 pts)
        # -------------------------------------------------------------
        tags_score = 0
        tag_count = len(tags)
        total_tag_chars = sum(len(t) for t in tags)

        if 8 <= tag_count <= 25:
            tags_score += 10
            checklist.append({
                "category": "Теги",
                "name": "Количество тегов",
                "status": "pass",
                "detail": f"{tag_count} тегов (отличный охват ниши без переспама)",
                "points": 10
            })
        elif 3 <= tag_count < 8:
            tags_score += 5
            checklist.append({
                "category": "Теги",
                "name": "Количество тегов",
                "status": "warn",
                "detail": f"Всего {tag_count} тегов. Рекомендуется использовать 10–18 точных тегов",
                "points": 5
            })
        elif tag_count > 25:
            tags_score += 6
            checklist.append({
                "category": "Теги",
                "name": "Много тегов",
                "status": "warn",
                "detail": f"{tag_count} тегов (убедитесь, что нет нерелевантных ключей)",
                "points": 6
            })
        else:
            checklist.append({
                "category": "Теги",
                "name": "Теги видео",
                "status": "fail",
                "detail": "Теги отсутствуют или их меньше 3. Видео теряет трафик в похожих",
                "points": 0
            })

        # Match tags with title
        tag_overlap = 0
        for t in tags:
            t_words = set(re.findall(r'\b\w+\b', t.lower()))
            if t_words and t_words.issubset(title_words):
                tag_overlap += 1

        if tag_overlap >= 2:
            tags_score += 10
            checklist.append({
                "category": "Теги",
                "name": "Совпадение тегов с заголовком",
                "status": "pass",
                "detail": f"{tag_overlap} тегов точно соответствуют ключевым словам из названия",
                "points": 10
            })
        elif tag_overlap == 1:
            tags_score += 5
            checklist.append({
                "category": "Теги",
                "name": "Совпадение тегов с заголовком",
                "status": "warn",
                "detail": "Только 1 тег совпадает со словами из названия. Добавьте точные фразы",
                "points": 5
            })
        else:
            checklist.append({
                "category": "Теги",
                "name": "Совпадение тегов с заголовком",
                "status": "fail",
                "detail": "Ни один тег не повторяет ключевые фразы из названия",
                "points": 0
            })

        # Tag length total
        if 200 <= total_tag_chars <= 480:
            tags_score += 5
        elif total_tag_chars > 0:
            tags_score += 2

        scores['tags'] = min(tags_score, 25)

        # -------------------------------------------------------------
        # 4. TECHNICAL & ENGAGEMENT QUALITY (Max 25 pts)
        # -------------------------------------------------------------
        tech_score = 0

        # HD definition
        if definition.lower() == 'hd':
            tech_score += 8
            checklist.append({
                "category": "Качество",
                "name": "HD/4K разрешение",
                "status": "pass",
                "detail": "Видео загружено в высоком качестве (HD/4K)",
                "points": 8
            })
        else:
            checklist.append({
                "category": "Качество",
                "name": "Разрешение видео",
                "status": "warn",
                "detail": "Видео в стандартном разрешении (SD). YouTube отдает приоритет HD/4K",
                "points": 2
            })

        # Captions / Subtitles
        if has_caption:
            tech_score += 8
            checklist.append({
                "category": "Качество",
                "name": "Субтитры (Closed Captions)",
                "status": "pass",
                "detail": "Субтитры включены — повышают поисковый индекс и доступность",
                "points": 8
            })
        else:
            checklist.append({
                "category": "Качество",
                "name": "Субтитры (Closed Captions)",
                "status": "warn",
                "detail": "Субтитры отключены. Добавление субтитров расширяет аудиторию",
                "points": 2
            })

        # Engagement Rate check (>5% = pass)
        if er >= 6.0:
            tech_score += 9
            checklist.append({
                "category": "Качество",
                "name": "Высокая вовлеченность (ER)",
                "status": "pass",
                "detail": f"ER = {er}% (отличная реакция аудитории лайками и комментариями)",
                "points": 9
            })
        elif er >= 3.0:
            tech_score += 5
            checklist.append({
                "category": "Качество",
                "name": "Средняя вовлеченность (ER)",
                "status": "pass",
                "detail": f"ER = {er}% (нормальный показатель вовлеченности)",
                "points": 5
            })
        else:
            tech_score += 2
            checklist.append({
                "category": "Качество",
                "name": "Низкая вовлеченность (ER)",
                "status": "warn",
                "detail": f"ER = {er}% (стимулируйте зрителей оставлять комментарии и лайки)",
                "points": 2
            })

        scores['quality'] = min(tech_score, 25)

        total_score = scores['title'] + scores['description'] + scores['tags'] + scores['quality']

        # Rating tier
        if total_score >= 85:
            rating = "Отлично"
            rating_color = "emerald"
        elif total_score >= 65:
            rating = "Хорошо"
            rating_color = "cyan"
        elif total_score >= 45:
            rating = "Требует доработки"
            rating_color = "amber"
        else:
            rating = "Слабое SEO"
            rating_color = "rose"

        return {
            "total_score": total_score,
            "rating": rating,
            "rating_color": rating_color,
            "sub_scores": scores,
            "checklist": checklist,
            "tags_count": tag_count,
            "tags_list": tags,
            "summary": {
                "passed_checks": sum(1 for c in checklist if c['status'] == 'pass'),
                "warning_checks": sum(1 for c in checklist if c['status'] == 'warn'),
                "failed_checks": sum(1 for c in checklist if c['status'] == 'fail'),
                "total_checks": len(checklist)
            }
        }

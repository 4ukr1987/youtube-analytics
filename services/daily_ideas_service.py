"""
AI Daily Ideas Service - Generates personalized daily video ideas with
virality potential predictions (Very High / High / Medium), hook concepts,
and thumbnail suggestions with Save/Dismiss card tracking.
"""

import uuid
import re
import json
import random
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from .db_service import DatabaseService
from .ai_assistant import AIAssistant
from .keyword_service import KeywordService


class DailyIdeasService:
    def __init__(self, db_service: Optional[DatabaseService] = None, ai_assistant: Optional[AIAssistant] = None, keyword_service: Optional[KeywordService] = None):
        self.db = db_service or DatabaseService()
        self.ai = ai_assistant or AIAssistant()
        self.keywords = keyword_service or KeywordService()
        self._init_ideas_table()

    def _init_ideas_table(self):
        with self.db._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS daily_ideas (
                    id TEXT PRIMARY KEY,
                    niche TEXT NOT NULL,
                    title TEXT NOT NULL,
                    potential_badge TEXT NOT NULL,
                    potential_score INTEGER NOT NULL,
                    reason TEXT,
                    hook TEXT,
                    thumbnail_idea TEXT,
                    target_tags TEXT,
                    status TEXT DEFAULT 'new',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def get_ideas(self, niche: str = "YouTube & ИИ", status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns ideas from database filtered by status, or generates fresh ones if empty"""
        with self.db._get_conn() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute("SELECT * FROM daily_ideas WHERE status = ? ORDER BY created_at DESC", (status,))
            else:
                cursor.execute("SELECT * FROM daily_ideas WHERE status != 'dismissed' ORDER BY created_at DESC")
            rows = cursor.fetchall()

            if not rows and (status is None or status == 'new'):
                # Generate fresh batch for today
                return self.generate_fresh_daily_ideas(niche)

            return [dict(r) for r in rows]

    def generate_fresh_daily_ideas(self, niche: str = "YouTube & ИИ") -> List[Dict[str, Any]]:
        """Generates a batch of 5 high-potential daily video ideas"""
        generated = []

        # 1. Try with Gemini AI if configured
        if self.ai.is_ai_configured():
            prompt = f"""
            You are the Chief Growth Strategist at vidIQ.
            Generate 5 VIRAL YouTube video ideas for the niche: "{niche}".
            Each idea must have a catchy title, a prediction potential (VERY HIGH / HIGH),
            a viral reason why it works, a 5-second hook, and a thumbnail visual concept.

            Return STRICT JSON format:
            [
              {{
                "title": "Viral YouTube Title",
                "potential_badge": "VERY HIGH",
                "potential_score": 96,
                "reason": "High search volume + strong emotional trigger",
                "hook": "First 5 seconds speech hook",
                "thumbnail_idea": "Visual description for thumbnail with high contrast",
                "target_tags": "tag1, tag2, tag3"
              }}
            ]
            """
            raw = self.ai._call_gemini(prompt)
            if raw:
                try:
                    match = re.search(r'\[.*\]', raw, re.DOTALL)
                    if match:
                        data = json.loads(match.group(0))
                        for item in data:
                            idea_id = f"idea_{uuid.uuid4().hex[:8]}"
                            generated.append({
                                "id": idea_id,
                                "niche": niche,
                                "title": item.get('title', ''),
                                "potential_badge": item.get('potential_badge', 'VERY HIGH'),
                                "potential_score": int(item.get('potential_score', 92)),
                                "reason": item.get('reason', ''),
                                "hook": item.get('hook', ''),
                                "thumbnail_idea": item.get('thumbnail_idea', ''),
                                "target_tags": item.get('target_tags', ''),
                                "status": "new"
                            })
                except Exception as e:
                    print(f"AI idea parsing error: {e}")

        # 2. Heuristic smart presets if AI not available or fallback
        if not generated:
            presets = [
                {
                    "title": f"Я Проверил 7 Скрытых Инструментов в {niche} (И Вот Что Случилось)",
                    "potential_badge": "VERY HIGH",
                    "potential_score": 97,
                    "reason": "Формат челленджа + любопытство. Исторически дает +45% к кликабельности (CTR).",
                    "hook": "90% авторов тратят часы на рутину, даже не подозревая, что эти 7 инструментов делают всё за секунды...",
                    "thumbnail_idea": "Разделенный экран: слева уставший человек с надписью 'Вручную (5 часов)', справа молния и результат 'AI (30 сек)'",
                    "target_tags": f"{niche}, топ инструменты, обзор, автоматизация, секреты"
                },
                {
                    "title": f"Никогда Не Делайте Эту Ошибку в {niche} в 2024 Году!",
                    "potential_badge": "VERY HIGH",
                    "potential_score": 94,
                    "reason": "Триггер страха потери (FOMO). Заставляет зрителя нажать, чтобы проверить себя.",
                    "hook": "Если вы до сих пор делаете это по старинке, вы буквально теряете просмотры и деньги прямо сейчас...",
                    "thumbnail_idea": "Красный предупреждающий знак СТОП, эмоциональное лицо автора и зачеркнутая стрелка",
                    "target_tags": f"{niche}, главные ошибки, как правильно, гайд, советы"
                },
                {
                    "title": f"Пошаговый План С Нуля До Результата в {niche} (Полный Курс За 20 Минут)",
                    "potential_badge": "HIGH",
                    "potential_score": 89,
                    "reason": "Высокий вечнозеленый поисковый трафик (Evergreen SEO). Видео будет набирать просмотры годами.",
                    "hook": "В этом ролике нет никакой воды — только четкая дорожная карта от А до Я, которую я собирал 3 года...",
                    "thumbnail_idea": "Красивая дорожная карта со стрелками от $0 до $10,000 с крупным текстом 'ОТ 0 ДО ПРОФИ'",
                    "target_tags": f"{niche}, обучение с нуля, пошаговый план, гайд 2024, туториал"
                },
                {
                    "title": f"Сравнение Топ 3 Сервисов в {niche}: Честный Тест Без Рекламы",
                    "potential_badge": "HIGH",
                    "potential_score": 85,
                    "reason": "Аудитория на этапе выбора решения. Высочайшая вовлеченность и глубина удержания.",
                    "hook": "Один из этих сервисов переоценен в 10 раз, а второй бесплатный и работает лучше всех. Сейчас покажу...",
                    "thumbnail_idea": "3 логотипа сервисов рядом с золотой короной победителя и знаком вопроса",
                    "target_tags": f"{niche}, сравнение, честный отзыв, какой выбрать, топ"
                },
                {
                    "title": f"Как За 1 День Изменить Свои Результаты в {niche} (Метод 80/20)",
                    "potential_badge": "HIGH",
                    "potential_score": 82,
                    "reason": "Обещание быстрого и концентрированного результата с опорой на закон Парето.",
                    "hook": "Что если я скажу, что всего 20% правильных действий дают 80% всех ваших результатов?",
                    "thumbnail_idea": "График резкого взлета зеленой стрелки вверх с плашкой '+340% РОСТ'",
                    "target_tags": f"{niche}, продуктивность, секретный метод, быстрый рост"
                }
            ]

            for p in presets:
                idea_id = f"idea_{uuid.uuid4().hex[:8]}"
                generated.append({
                    "id": idea_id,
                    "niche": niche,
                    "title": p['title'],
                    "potential_badge": p['potential_badge'],
                    "potential_score": p['potential_score'],
                    "reason": p['reason'],
                    "hook": p['hook'],
                    "thumbnail_idea": p['thumbnail_idea'],
                    "target_tags": p['target_tags'],
                    "status": "new"
                })

        # Save to database
        with self.db._get_conn() as conn:
            cursor = conn.cursor()
            for idea in generated:
                cursor.execute("""
                    INSERT INTO daily_ideas (
                        id, niche, title, potential_badge, potential_score,
                        reason, hook, thumbnail_idea, target_tags, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
                    ON CONFLICT(id) DO NOTHING
                """, (
                    idea['id'], idea['niche'], idea['title'], idea['potential_badge'],
                    idea['potential_score'], idea['reason'], idea['hook'],
                    idea['thumbnail_idea'], idea['target_tags']
                ))
            conn.commit()

        return generated

    def update_idea_status(self, idea_id: str, status: str) -> bool:
        """Updates idea status ('saved', 'dismissed', 'new')"""
        with self.db._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE daily_ideas SET status = ? WHERE id = ?", (status, idea_id))
            conn.commit()
            return cursor.rowcount > 0

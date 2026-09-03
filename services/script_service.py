"""
AI Video Script & Shorts Generator Service (vidIQ Max Grade)
Produces full production-ready YouTube video scripts with visual B-roll cues and Shorts scripts using Gemini.
"""

from typing import Dict, Any, Optional, List
import json
from services.ai_assistant import AIAssistant


class ScriptService:
    def __init__(self, ai_assistant: AIAssistant):
        self.ai = ai_assistant

    def generate_full_script(
        self,
        topic: str,
        duration_minutes: int = 10,
        target_audience: str = "Широкая аудитория",
        tone: str = "Энергичный и увлекательный"
    ) -> Dict[str, Any]:
        """
        Generates a complete minute-by-minute YouTube video script with hooks and B-roll cues.
        """
        prompt = f"""Ты — лучший YouTube сценарист и продюсер (уровень MrBeast, Ali Abdaal, Veritasium).
Напиши полный профессиональный сценарий для YouTube видео:
- Тема ролика: "{topic}"
- Длительность: ~{duration_minutes} минут
- Целевая аудитория: "{target_audience}"
- Тон повествования: "{tone}"

Сценарий должен строго удерживать внимание (Retention Rate > 70%) и включать:
1. "title_options": 3 кликабельных варианта заголовка.
2. "hook_section": Хук первых 0-30 секунд (что говорит спикер вслух + визуальная ремарка на экране B-Roll).
3. "intro_premise": Завязка и обещание ценности (30с - 1:30).
4. "core_sections": 3-4 ключевых смысловых блока. Каждый блок должен содержать:
   - "timecode": например "01:30 - 04:00"
   - "heading": название части
   - "spoken_text": развернутый текст спикера для озвучки
   - "b_roll_visuals": что показывать на монтаже (футажи, анимации, графики, эффекты)
5. "climax_and_reveal": кульминация и главный инсайт ролика.
6. "outro_cta": призыв к действию (подписка, переход на следующее видео) без потери темпа.

Верни ТОЛЬКО валидный JSON:
{{
  "title_options": ["...", "...", "..."],
  "estimated_reading_time": "{duration_minutes} мин",
  "hook_section": {{
    "spoken_text": "...",
    "visual_b_roll": "..."
  }},
  "intro_premise": {{
    "spoken_text": "...",
    "visual_b_roll": "..."
  }},
  "core_sections": [
    {{
      "timecode": "01:30 - 04:00",
      "heading": "...",
      "spoken_text": "...",
      "b_roll_visuals": "..."
    }}
  ],
  "climax_and_reveal": {{
    "spoken_text": "...",
    "visual_b_roll": "..."
  }},
  "outro_cta": {{
    "spoken_text": "...",
    "visual_b_roll": "..."
  }}
}}
"""
        try:
            resp = self.ai._call_gemini(prompt)
            if resp:
                cleaned = resp.replace('```json', '').replace('```', '').strip()
                return json.loads(cleaned)
        except Exception:
            pass

        # Fallback structured script
        return {
            "title_options": [
                f"Как {topic}: Полный Разбор от А до Я",
                f"Я Проверил {topic} — Вот Что Случилось На Самом Деле",
                f"Секреты {topic}, О Которых Молчат 99% Людей"
            ],
            "estimated_reading_time": f"{duration_minutes} мин",
            "hook_section": {
                "spoken_text": f"Если вы думаете, что {topic} — это сложно или требует месяцев подготовки, следующие 5 минут полностью перевернут ваше представление. Сегодня я покажу скрытую механику, о которой почти никто не говорит.",
                "visual_b_roll": "Крупный план спикера, быстрая нарезка динамичных футажей с саунд-дизайном (whoosh) и вылет яркой инфографики."
            },
            "intro_premise": {
                "spoken_text": "В этом ролике мы разберем не просто теорию, а пошаговый алгоритм, который вы сможете применить прямо сегодня.",
                "visual_b_roll": "Таймлапс работы за экраном, появление плашек с таймкодами ролика."
            },
            "core_sections": [
                {
                    "timecode": "01:15 - 04:30",
                    "heading": "Шаг 1: Фундамент и главная ошибка новичков",
                    "spoken_text": "Большинство людей начинают с неправильного конца. Они тратят недели на второстепенные вещи, забывая про базовый рычаг.",
                    "b_roll_visuals": "Анимация графика с красным крестом (ошибка) и зеленой галочкой (правильный метод)."
                },
                {
                    "timecode": "04:30 - 08:00",
                    "heading": "Шаг 2: Пошаговая реализация на практике",
                    "spoken_text": "Теперь переходим к самому интересному. Вот точная схема из трех действий, которая дает 80% результата.",
                    "b_roll_visuals": "Запись экрана с демонстрацией процесса шаг за шагом, стрелочки и зум на важные элементы."
                }
            ],
            "climax_and_reveal": {
                "spoken_text": "И вот главный секрет: всё зависит от одного простого действия, которое меняет правила игры.",
                "visual_b_roll": "Замедленный кадр (slow-mo), фоновая музыка затихает перед финальным инсайтом."
            },
            "outro_cta": {
                "spoken_text": "Если этот разбор был полезен — поставьте лайк и посмотрите вот это видео на экране, оно идеально дополняет сегодняшнюю тему!",
                "visual_b_roll": "Вылет конечной заставки с подсказкой на следующее видео и кнопкой подписки."
            }
        }

    def generate_shorts_pack(self, topic: str) -> List[Dict[str, Any]]:
        """
        Generates 3 viral YouTube Shorts / Reels scripts (45-60s) with text overlays.
        """
        prompt = f"""Ты — эксперт по вирусным YouTube Shorts и TikTok (миллионные охваты).
Создай 3 принципиально разных вирусных сценария для YouTube Shorts по теме:
"{topic}"

Каждый сценарий должен быть рассчитан на 45–55 секунд и содержать:
1. "angle": ракурс/концепт ролика (напр. "Миф против реальности", "Лайфхак за 30 секунд", "Шокирующий факт").
2. "hook": хук первых 3 секунд, чтобы остановить скролл.
3. "on_screen_text": крупный текст на экране для первых секунд.
4. "script_dialogue": текст спикера в быстром разговорном темпе (120-140 слов).
5. "visual_actions": действия в кадре (жесты, предметы, склейки каждые 2-3 секунды).
6. "final_loop_hook": бесшовная фраза в конце, которая идеально переходит в начало ролика (Loop).

Верни ТОЛЬКО валидный JSON массив из 3 объектов:
[
  {{
    "angle": "...",
    "hook": "...",
    "on_screen_text": "...",
    "script_dialogue": "...",
    "visual_actions": "...",
    "final_loop_hook": "..."
  }}
]
"""
        try:
            resp = self.ai._call_gemini(prompt)
            if resp:
                cleaned = resp.replace('```json', '').replace('```', '').strip()
                return json.loads(cleaned)
        except Exception:
            pass

        return [
            {
                "angle": "Шокирующий факт / Интрига",
                "hook": f"Перестаньте делать это, если вы хотите разобраться в {topic}!",
                "on_screen_text": "НЕ ДЕЛАЙ ЭТО ❌",
                "script_dialogue": f"90% людей совершают одну и ту же фатальную ошибку. Они думают, что {topic} требует сложных инструментов. Но на самом деле достаточно знать один простой трюк. Смотрите: вы открываете базовую настройку, меняете один параметр — и результат вырастает в 3 раза. Попробуйте прямо сейчас!",
                "visual_actions": "Спикер эмоционально указывает на экран, зум каждые 2 секунды, субтитры по 1 слову в центре экрана.",
                "final_loop_hook": "И именно поэтому..."
            },
            {
                "angle": "Лайфхак за 30 секунд",
                "hook": f"Этот секрет по {topic} сэкономит вам 10 часов времени.",
                "on_screen_text": "СЕКРЕТ 🤫",
                "script_dialogue": f"Сохраняйте, чтобы не потерять. Шаг первый: заходим в сервис. Шаг второй: применяем готовый шаблон. Шаг третий: получаем результат за пару кликов. Всё гениальное просто!",
                "visual_actions": "Динамичная запись экрана смартфона с подсветкой кнопок.",
                "final_loop_hook": "А если вы не знали..."
            },
            {
                "angle": "Миф против Реальности",
                "hook": f"Вам всё это время врали про {topic}!",
                "on_screen_text": "ВАМ ВРАЛИ 🚨",
                "script_dialogue": f"Все говорят, что здесь нужны огромные бюджеты. Но реальность в том, что алгоритмы любят простоту и регулярность. Вот как это работает на самом деле...",
                "visual_actions": "Разделенный экран: слева МИФ, справа РЕАЛЬНОСТЬ.",
                "final_loop_hook": "Поэтому помните..."
            }
        ]

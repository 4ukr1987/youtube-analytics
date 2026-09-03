/**
 * AI Video Script & Shorts Studio Module (vidIQ Max Grade)
 */

let currentScriptMode = 'full'; // 'full' | 'shorts'
let cachedFullScript = null;
let cachedShortsPack = null;

function switchScriptMode(mode) {
  currentScriptMode = mode;
  const fullBtn = document.getElementById('scriptMode_full');
  const shortsBtn = document.getElementById('scriptMode_shorts');
  const durationField = document.getElementById('scriptDurationField');

  if (mode === 'full') {
    if (fullBtn) fullBtn.classList.add('active');
    if (shortsBtn) shortsBtn.classList.remove('active');
    if (durationField) durationField.classList.remove('hidden');
  } else {
    if (shortsBtn) shortsBtn.classList.add('active');
    if (fullBtn) fullBtn.classList.remove('active');
    if (durationField) durationField.classList.add('hidden');
  }
}

async function handleScriptSubmit(e) {
  if (e) e.preventDefault();
  const topic = document.getElementById('scriptTopicInput')?.value.trim();
  if (!topic) return;

  setLoading(true);
  const container = document.getElementById('scriptResultsContainer');
  if (container) container.innerHTML = '';

  if (currentScriptMode === 'full') {
    await generateFullVideoScript(topic);
  } else {
    await generateShortsPack(topic);
  }
}

async function generateFullVideoScript(topic) {
  const duration = parseInt(document.getElementById('scriptDurationInput')?.value || "10", 10);
  const tone = document.getElementById('scriptToneSelect')?.value || "Энергичный и увлекательный";
  const container = document.getElementById('scriptResultsContainer');

  try {
    const res = await fetch('/api/scripts/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        duration_minutes: duration,
        target_audience: "Широкая аудитория",
        tone
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка генерации сценария");

    cachedFullScript = data.script;
    renderFullScriptView(data.script);
  } catch (err) {
    if (container) {
      container.innerHTML = `<div class="p-4 text-xs text-rose-400 bg-rose-950/20 border border-rose-800/40 rounded-xl">${err.message}</div>`;
    }
  } finally {
    setLoading(false);
    if (window.lucide) lucide.createIcons();
  }
}

async function generateShortsPack(topic) {
  const container = document.getElementById('scriptResultsContainer');

  try {
    const res = await fetch('/api/scripts/shorts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка генерации Shorts");

    cachedShortsPack = data.shorts;
    renderShortsPackView(data.shorts);
  } catch (err) {
    if (container) {
      container.innerHTML = `<div class="p-4 text-xs text-rose-400 bg-rose-950/20 border border-rose-800/40 rounded-xl">${err.message}</div>`;
    }
  } finally {
    setLoading(false);
    if (window.lucide) lucide.createIcons();
  }
}

function renderFullScriptView(s) {
  const container = document.getElementById('scriptResultsContainer');
  if (!container) return;

  // Title suggestions
  let titlesHtml = '';
  (s.title_options || []).forEach((t, i) => {
    titlesHtml += `
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-bg-input border border-bg-border text-xs">
        <span class="text-white font-medium"><b>${i + 1}.</b> ${t}</span>
        <button onclick="copyText('${t.replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-white p-1" title="Копировать"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
      </div>
    `;
  });

  // Core sections
  let sectionsHtml = '';
  (s.core_sections || []).forEach(sec => {
    sectionsHtml += `
      <div class="p-4 rounded-xl bg-bg-card border border-bg-border space-y-3">
        <div class="flex items-center justify-between border-b border-bg-border pb-2">
          <span class="text-xs font-bold text-white flex items-center gap-1.5">
            <i data-lucide="bookmark" class="w-3.5 h-3.5 text-blue-400"></i>
            <span>${sec.heading}</span>
          </span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">${sec.timecode}</span>
        </div>

        <div class="space-y-1">
          <span class="text-[10px] font-bold uppercase text-slate-400">Текст озвучки (Спикер):</span>
          <p class="text-xs text-slate-200 leading-relaxed">${sec.spoken_text}</p>
        </div>

        <div class="p-2.5 rounded-lg bg-blue-950/30 border border-blue-800/40 space-y-1">
          <span class="text-[10px] font-bold uppercase text-blue-400 flex items-center gap-1">
            <i data-lucide="video" class="w-3 h-3"></i>
            <span>Монтажные ремарки (B-Roll футажи):</span>
          </span>
          <p class="text-[11px] text-blue-200">${sec.b_roll_visuals}</p>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Top Bar: Titles + Copy all -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-bg-border pb-3">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60 uppercase">Full Video Script</span>
            <span class="text-xs text-slate-400 font-mono">Хронометраж: ~${s.estimated_reading_time}</span>
          </div>
          <button onclick="copyFullScript()" class="btn-primary text-xs">
            <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
            <span>Скопировать весь сценарий</span>
          </button>
        </div>

        <div class="space-y-2">
          <span class="text-[11px] font-bold uppercase text-slate-400">Варианты кликабельных заголовков:</span>
          <div class="space-y-1.5">${titlesHtml}</div>
        </div>
      </div>

      <!-- 1. The Viral Hook -->
      <div class="p-5 rounded-xl bg-amber-950/20 border border-amber-800/50 space-y-3">
        <div class="flex items-center justify-between border-b border-amber-800/30 pb-2">
          <span class="text-xs font-bold text-amber-300 flex items-center gap-1.5 uppercase">
            <i data-lucide="flame" class="w-4 h-4 text-amber-400"></i>
            <span>1. Хук удержания первых 0–30 секунд</span>
          </span>
          <span class="text-[10px] font-mono text-amber-400">Удержание >70%</span>
        </div>
        <div class="space-y-1">
          <span class="text-[10px] font-bold uppercase text-slate-400">Текст спикера:</span>
          <p class="text-xs text-amber-100 font-medium leading-relaxed">${s.hook_section.spoken_text}</p>
        </div>
        <div class="p-2.5 rounded-lg bg-amber-900/40 border border-amber-700/50 text-[11px] text-amber-200">
          <b>Визуальный ряд:</b> ${s.hook_section.visual_b_roll}
        </div>
      </div>

      <!-- 2. Core Sections -->
      <div class="space-y-4">
        ${sectionsHtml}
      </div>

      <!-- 3. Climax & Outro -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 rounded-xl bg-bg-card border border-bg-border space-y-2">
          <span class="text-xs font-bold text-purple-400 flex items-center gap-1.5">
            <i data-lucide="zap" class="w-3.5 h-3.5"></i>
            <span>Кульминация (Главный инсайт):</span>
          </span>
          <p class="text-xs text-slate-200 leading-relaxed">${s.climax_and_reveal.spoken_text}</p>
        </div>

        <div class="p-4 rounded-xl bg-bg-card border border-bg-border space-y-2">
          <span class="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <i data-lucide="arrow-right-circle" class="w-3.5 h-3.5"></i>
            <span>Финал & Бесшовный CTA:</span>
          </span>
          <p class="text-xs text-slate-200 leading-relaxed">${s.outro_cta.spoken_text}</p>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderShortsPackView(shorts) {
  const container = document.getElementById('scriptResultsContainer');
  if (!container) return;

  let cardsHtml = '';
  shorts.forEach((sh, idx) => {
    cardsHtml += `
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg">
        
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-bg-border pb-2.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/60 text-purple-300 border border-purple-800/60 uppercase">
              Shorts #${idx + 1}: ${sh.angle}
            </span>
            <span class="text-[10px] font-mono text-slate-400">45-55 сек</span>
          </div>

          <!-- On-screen text -->
          <div class="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/50 space-y-1">
            <span class="text-[9px] uppercase font-bold text-rose-400">Крупный текст на экране (0-3 сек):</span>
            <div class="text-sm font-black text-white uppercase">${sh.on_screen_text}</div>
          </div>

          <!-- Spoken dialogue -->
          <div class="space-y-1">
            <span class="text-[10px] uppercase font-bold text-slate-400">Текст спикера (Voiceover):</span>
            <p class="text-xs text-slate-200 leading-relaxed font-normal">${sh.script_dialogue}</p>
          </div>

          <!-- Visual actions -->
          <div class="p-2 rounded bg-bg-input border border-bg-border text-[11px] text-slate-400">
            <b class="text-slate-300">Действия в кадре:</b> ${sh.visual_actions}
          </div>

          <!-- Loop hook -->
          <div class="p-2 rounded bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300">
            <b>Бесшовный Loop-переход:</b> «${sh.final_loop_hook}»
          </div>
        </div>

        <div class="pt-2 border-t border-bg-border">
          <button onclick="copyText('${sh.script_dialogue.replace(/'/g, "\\'")}')" class="w-full btn-purple text-xs justify-center">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            <span>Скопировать текст Shorts</span>
          </button>
        </div>

      </div>
    `;
  });

  container.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs text-purple-300 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i data-lucide="sparkles" class="w-4 h-4 text-purple-400 shrink-0"></i>
          <span>Сгенерировано <b>3 вирусных сценария для YouTube Shorts / Reels</b></span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        ${cardsHtml}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function copyFullScript() {
  if (!cachedFullScript) return;
  const s = cachedFullScript;
  let fullText = `=== СЦЕНАРИЙ YOUTUBE ВИДЕО ===\n\n`;
  fullText += `ВАРИАНТЫ ЗАГОЛОВКОВ:\n${(s.title_options || []).join('\n')}\n\n`;
  fullText += `[00:00 - 00:30] ХУК:\n${s.hook_section.spoken_text}\n(B-Roll: ${s.hook_section.visual_b_roll})\n\n`;
  
  (s.core_sections || []).forEach(sec => {
    fullText += `[${sec.timecode}] ${sec.heading}:\n${sec.spoken_text}\n(B-Roll: ${sec.b_roll_visuals})\n\n`;
  });

  fullText += `ФИНАЛ & CTA:\n${s.outro_cta.spoken_text}\n`;
  copyText(fullText);
  showToast("Весь сценарий скопирован в буфер обмена!");
}

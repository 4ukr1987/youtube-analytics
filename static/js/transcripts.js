/**
 * Video Transcripts & AI Summary Module
 */

let activeTranscriptCues = [];
let lastLoadedTranscriptVideoId = null;

function extractCleanVideoId(input) {
  if (!input) return '';
  input = input.trim();
  if (input.includes('v=')) {
    const match = input.match(/v=([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }
  if (input.includes('youtu.be/')) {
    const match = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }
  return input;
}

function quickExtractTranscript(videoId) {
  const cleanId = extractCleanVideoId(videoId);
  switchHub('video_hub', 'transcripts');
  const input = document.getElementById('transcriptSearchInput');
  if (input) input.value = cleanId;
  lastLoadedTranscriptVideoId = cleanId;
  loadTranscript(cleanId);
}

function syncTranscriptWithActiveVideo(videoData) {
  if (!videoData || !videoData.id) return;
  const cleanId = extractCleanVideoId(videoData.id);
  const input = document.getElementById('transcriptSearchInput');
  if (input) input.value = `https://www.youtube.com/watch?v=${cleanId}`;

  const container = document.getElementById('transcriptResultsContainer');
  const isEmpty = !container || container.innerHTML.trim() === '';
  const isDifferent = lastLoadedTranscriptVideoId !== cleanId;

  if (isEmpty || isDifferent) {
    lastLoadedTranscriptVideoId = cleanId;
    loadTranscript(cleanId);
  }
}

function extractTranscriptSearch() {
  const val = document.getElementById('transcriptSearchInput').value.trim();
  if (!val) return;
  const cleanId = extractCleanVideoId(val);
  lastLoadedTranscriptVideoId = cleanId;
  loadTranscript(cleanId);
}

async function loadTranscript(videoId) {
  setLoading(true);
  const container = document.getElementById('transcriptResultsContainer');
  if (!container) return;
  
  container.innerHTML = `
    <div class="p-10 rounded-xl bg-[#12131b] border border-white/[0.08] text-center space-y-3 fade-in">
      <div class="w-8 h-8 rounded-full border-2 border-slate-700 border-t-sky-400 animate-spin mx-auto"></div>
      <div class="text-xs font-semibold text-slate-200">Извлечение субтитров и генерация AI-конспекта...</div>
      <p class="text-[11px] text-slate-400">Gemini 3.7 анализирует ключевые тезисы и структуру ролика</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/transcript?video_id=${encodeURIComponent(videoId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка при получении транскрипта");

    activeTranscriptCues = data.data.cues || [];
    renderTranscriptView(data.data);
  } catch (err) {
    container.innerHTML = `
      <div class="p-5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-3">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400 shrink-0"></i>
        <span>${err.message}</span>
      </div>
    `;
  } finally {
    setLoading(false);
    if (window.lucide) lucide.createIcons();
  }
}

function filterTranscriptCues() {
  const query = document.getElementById('transcriptFilterInput').value.toLowerCase().trim();
  const cueElements = document.querySelectorAll('.transcript-cue-row');
  let matchCount = 0;

  cueElements.forEach(el => {
    const text = el.getAttribute('data-text') || '';
    if (!query || text.toLowerCase().includes(query)) {
      el.classList.remove('hidden');
      matchCount++;
    } else {
      el.classList.add('hidden');
    }
  });

  const countBadge = document.getElementById('transcriptMatchCount');
  if (countBadge) {
    countBadge.textContent = query ? `Найдено: ${matchCount}` : `Всего: ${cueElements.length}`;
  }
}

function copyAllTranscript() {
  if (!activeTranscriptCues.length) return;
  const fullText = activeTranscriptCues.map(c => `[${c.timestamp}] ${c.text}`).join('\n');
  copyToClipboard(fullText, "Полный транскрипт скопирован в буфер обмена!");
}

function downloadSRT() {
  if (!activeTranscriptCues.length) return;
  let srtContent = '';
  activeTranscriptCues.forEach((c, idx) => {
    const startSec = c.start || 0;
    const endSec = startSec + (c.duration || 3);
    const formatSRTTime = (seconds) => {
      const date = new Date(0);
      date.setMilliseconds(seconds * 1000);
      const iso = date.toISOString();
      return iso.substr(11, 8) + ',' + ('00' + Math.floor((seconds % 1) * 1000)).slice(-3);
    };
    srtContent += `${idx + 1}\n${formatSRTTime(startSec)} --> ${formatSRTTime(endSec)}\n${c.text}\n\n`;
  });

  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `transcript_${Date.now()}.srt`;
  a.click();
  showToast("SRT субтитры скачаны!");
}

function renderTranscriptView(data) {
  const container = document.getElementById('transcriptResultsContainer');
  if (!container) return;

  const totalWords = data.text ? data.text.split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMin = Math.ceil(totalWords / 150);

  let keyTakeawaysHtml = '';
  if (data.key_takeaways && data.key_takeaways.length) {
    data.key_takeaways.forEach(item => {
      keyTakeawaysHtml += `
        <li class="flex items-start gap-2 text-xs text-slate-300">
          <i data-lucide="check" class="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5"></i>
          <span>${item}</span>
        </li>
      `;
    });
  }

  let cuesHtml = '';
  data.cues.forEach(c => {
    cuesHtml += `
      <div class="transcript-cue-row p-2.5 rounded-lg bg-bg-input/60 border border-bg-border/60 hover:bg-slate-800/80 transition-colors flex items-start gap-3" data-text="${c.text.replace(/"/g, '&quot;')}">
        <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-sky-400 shrink-0 select-none">${c.timestamp}</span>
        <span class="text-xs text-slate-200 leading-relaxed">${c.text}</span>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Summary Card -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-bg-border pb-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950/60 text-sky-300 border border-sky-800/60 uppercase">AI Transcript Engine</span>
              <span class="text-xs text-slate-400 font-mono">${data.cues_count} реплик • ${totalWords} слов (~${readingTimeMin} мин чтения)</span>
            </div>
            <h3 class="text-base font-bold text-white leading-snug">${data.title}</h3>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button onclick="runHookAnalysis()" class="btn-secondary text-xs" title="Анализ первых 30 секунд удержания">
              <i data-lucide="zap" class="w-3.5 h-3.5 text-zinc-400"></i>
              <span>Анализ хука (0-30s)</span>
            </button>
            <button onclick="runShortsRepurposing()" class="btn-secondary text-xs" title="Нарезка на 3 вирусных Shorts">
              <i data-lucide="smartphone" class="w-3.5 h-3.5 text-zinc-400"></i>
              <span>Нарезать на Shorts</span>
            </button>
            <button onclick="copyAllTranscript()" class="btn-secondary text-xs">
              <i data-lucide="copy" class="w-3.5 h-3.5 text-zinc-400"></i>
              <span>Копировать весь текст</span>
            </button>
            <button onclick="downloadSRT()" class="btn-primary text-xs">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Скачать .SRT</span>
            </button>
          </div>
        </div>

        <!-- AI Executive Summary & Takeaways -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
          <div class="md:col-span-6 p-3.5 rounded-lg bg-bg-input border border-bg-border space-y-1.5">
            <div class="text-[10px] font-semibold uppercase text-sky-400 flex items-center gap-1">
              <i data-lucide="sparkles" class="w-3 h-3"></i>
              <span>AI-Резюме сути ролика:</span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${data.summary || "Транскрипт успешно извлечен."}</p>
          </div>

          <div class="md:col-span-6 p-3.5 rounded-lg bg-bg-input border border-bg-border space-y-1.5">
            <div class="text-[10px] font-semibold uppercase text-emerald-400 flex items-center gap-1">
              <i data-lucide="list" class="w-3 h-3"></i>
              <span>Ключевые тезисы:</span>
            </div>
            <ul class="space-y-1.5">
              ${keyTakeawaysHtml || '<li class="text-xs text-slate-400">Тезисы извлечены в транскрипте</li>'}
            </ul>
          </div>
        </div>

        <!-- Dynamic Container for Hook Analysis -->
        <div id="hookAnalysisContainer" class="hidden"></div>

        <!-- Dynamic Container for Shorts Repurposer -->
        <div id="shortsRepurposerContainer" class="hidden"></div>
      </div>

      <!-- Live Search & Interactive Cues Feed -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="relative flex-1 max-w-md">
            <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input 
              type="text" 
              id="transcriptFilterInput" 
              oninput="filterTranscriptCues()" 
              placeholder="Поиск по словам в стенограмме..." 
              class="w-full bg-bg-input border border-bg-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            >
          </div>
          <span id="transcriptMatchCount" class="text-xs font-mono text-slate-400 self-end sm:self-auto">Всего: ${data.cues.length}</span>
        </div>

        <div class="space-y-2 max-h-[600px] overflow-y-auto pr-1" id="transcriptCuesContainer">
          ${cuesHtml}
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

async function runHookAnalysis() {
  const container = document.getElementById('hookAnalysisContainer');
  if (!container) return;
  container.classList.remove('hidden');

  const introText = activeTranscriptCues.slice(0, 8).map(c => c.text).join(' ');
  const title = (document.querySelector('h3.text-base.font-bold')?.innerText || 'Видео ролик').trim();

  container.innerHTML = `
    <div class="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-center space-y-2 fade-in">
      <div class="w-6 h-6 rounded-full border-2 border-amber-600 border-t-amber-300 animate-spin mx-auto"></div>
      <div class="text-xs font-semibold text-amber-200">AI анализирует удержание первых 30 секунд...</div>
    </div>
  `;

  try {
    const res = await fetch('/api/transcript/hook-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intro_text: introText, video_title: title })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Ошибка анализа хука');

    const d = data.data;
    let hooksHtml = '';
    (d.hooks || []).forEach((h, i) => {
      hooksHtml += `
        <div class="p-3.5 rounded-lg bg-bg-input border border-bg-border space-y-2 hover:border-amber-500/40 transition-colors">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <span>Вариант ${i + 1}: ${h.type}</span>
            </span>
            <span class="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] font-mono font-bold">Удержание: ${h.predicted_retention || '85%+'}</span>
          </div>
          <p class="text-xs text-white leading-relaxed font-medium bg-black/40 p-2.5 rounded border border-white/[0.06] select-all">${h.script}</p>
          <div class="text-[11px] text-slate-400 flex items-center justify-between">
            <span>🎬 <strong>На экране:</strong> ${h.visual_cue || 'Динамичный зум'}</span>
            <button onclick="copyToClipboard('${h.script.replace(/'/g, "\\'")}', 'Хук скопирован!')" class="p-1 text-slate-400 hover:text-white transition-colors" title="Копировать">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    });

    let fluffListHtml = '';
    (d.fluff_points || []).forEach(f => {
      fluffListHtml += `<li class="text-xs text-rose-300 flex items-start gap-1.5"><i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5"></i><span>${f}</span></li>`;
    });

    container.innerHTML = `
      <div class="p-4 rounded-xl bg-[#161720] border border-amber-500/30 space-y-4 fade-in mt-4 shadow-lg">
        <div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div class="flex items-center gap-2">
            <i data-lucide="zap" class="w-4 h-4 text-amber-400"></i>
            <h4 class="text-xs font-bold uppercase text-white">AI Разбор первых 30 секунд & Retention Hooks</h4>
          </div>
          <span class="px-2.5 py-1 rounded bg-amber-950 border border-amber-800 text-amber-300 text-xs font-mono font-bold">Оценка удержания: ${d.score}/100</span>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">${d.retention_verdict}</p>

        ${fluffListHtml ? `<div class="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 space-y-1"><div class="text-[10px] font-bold uppercase text-rose-400">Слабые места текущего интро:</div><ul class="space-y-1">${fluffListHtml}</ul></div>` : ''}

        <div class="space-y-2">
          <div class="text-[10px] font-bold uppercase text-slate-400">3 альтернативных хука с высоким удержанием (MrBeast / Ali Abdaal Style):</div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            ${hooksHtml}
          </div>
        </div>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div class="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs">${err.message}</div>`;
  } finally {
    if (window.lucide) lucide.createIcons();
  }
}

async function runShortsRepurposing() {
  const container = document.getElementById('shortsRepurposerContainer');
  if (!container) return;
  container.classList.remove('hidden');

  const fullText = activeTranscriptCues.map(c => c.text).join(' ');
  const title = (document.querySelector('h3.text-base.font-bold')?.innerText || 'Видео ролик').trim();

  container.innerHTML = `
    <div class="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-center space-y-2 fade-in">
      <div class="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto"></div>
      <div class="text-xs font-semibold text-zinc-300">AI сканирует стенограмму и готовит 3 сценария Shorts...</div>
    </div>
  `;

  try {
    const res = await fetch('/api/transcript/repurpose-shorts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_text: fullText, video_title: title })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Ошибка генерации Shorts');

    const shorts = data.data || [];
    let shortsHtml = '';
    shorts.forEach((s, idx) => {
      shortsHtml += `
        <div class="p-4 rounded-xl bg-[#111215] border border-white/[0.08] space-y-3 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2">
              <span class="text-xs font-semibold text-white flex items-center gap-1.5">
                <i data-lucide="smartphone" class="w-3.5 h-3.5 text-zinc-400"></i>
                <span>Shorts #${idx + 1}: ${s.title}</span>
              </span>
              <span class="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-zinc-300 text-[10px] font-mono">${s.target_length || '45 сек'}</span>
            </div>

            <div class="mt-2.5 space-y-2">
              <div class="text-xs text-white bg-black/40 p-2.5 rounded border border-white/[0.06] font-medium leading-relaxed">
                <div class="text-[10px] uppercase text-zinc-400 font-bold mb-1">Голос за кадром (Voiceover):</div>
                ${s.voiceover_script}
              </div>

              <div class="p-2 rounded bg-bg-input text-[11px] text-zinc-300">
                <strong>Текст на экране:</strong> <span class="font-semibold text-white">${s.on_screen_text || ''}</span>
              </div>

              <div class="p-2 rounded bg-bg-input text-[11px] text-zinc-400">
                <strong>Монтаж (B-roll):</strong> ${s.b_roll_instructions || ''}
              </div>
            </div>
          </div>

          <div class="pt-2 flex items-center justify-between border-t border-white/[0.08]">
            <span class="text-[10px] text-zinc-500 font-mono">${s.hashtags || '#shorts #youtube'}</span>
            <button onclick="copyToClipboard('${(s.voiceover_script || '').replace(/'/g, "\\'")}', 'Сценарий Shorts скопирован!')" class="btn-secondary text-xs">
              <i data-lucide="copy" class="w-3 h-3"></i>
              <span>Копировать сценарий</span>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="p-4 rounded-xl bg-[#111215] border border-white/[0.08] space-y-4 fade-in mt-4 shadow-lg">
        <div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div class="flex items-center gap-2">
            <i data-lucide="smartphone" class="w-4 h-4 text-zinc-400"></i>
            <h4 class="text-xs font-bold uppercase text-white">AI Shorts Repurposer (3 Готовых вертикальных сценария)</h4>
          </div>
          <span class="text-xs text-zinc-400 font-mono">Готово к съемке</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${shortsHtml}
        </div>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div class="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs">${err.message}</div>`;
  } finally {
    if (window.lucide) lucide.createIcons();
  }
}

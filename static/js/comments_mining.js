/**
 * Audience Pain Points & Comments Mining Module
 * Clusters viewer feedback into future video topics, confusion points, and viral hooks.
 */

async function searchAndMineComments() {
  const input = document.getElementById('commentsVideoInput');
  const query = (input?.value || '').trim();
  if (!query) {
    showToast("Введите ссылку на YouTube видео или ID");
    return;
  }
  mineAudiencePainPoints(query);
}

async function mineAudiencePainPoints(videoIdOrUrl, videoTitle = "") {
  const container = document.getElementById('commentsMiningResultsContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="p-10 rounded-xl bg-[#12131b] border border-purple-500/30 text-center space-y-3 fade-in shadow-xl">
      <div class="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto"></div>
      <div class="text-sm font-bold text-white">Парсинг комментариев и кластеризация болей через Gemini 3.8...</div>
      <p class="text-xs text-slate-400 max-w-md mx-auto">Анализируем реакции зрителей, выявляем нераскрытые вопросы, скрытые возражения и идеи для следующих видео...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/ai/comments-mining', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoIdOrUrl,
        title: videoTitle,
        max_comments: 80
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка при анализе комментариев");

    renderCommentsMiningResults(data);
  } catch (err) {
    container.innerHTML = `
      <div class="p-5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-3">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400 shrink-0"></i>
        <span>${err.message}</span>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

function renderCommentsMiningResults(data) {
  const container = document.getElementById('commentsMiningResultsContainer');
  if (!container) return;

  const a = data.analysis || {};
  const topics = a.top_future_topics || [];
  const questions = a.confusion_questions || [];
  const triggers = a.emotional_triggers || { positive: [], controversial: [] };
  const hooks = a.viral_hooks_for_next_video || [];
  const sampleComments = data.sample_comments || [];

  // 1. Future Topics HTML
  let topicsHtml = '';
  topics.forEach((t, i) => {
    const safeTopic = (t.topic || '').replace(/'/g, "\\'");
    topicsHtml += `
      <div class="p-3.5 rounded-lg bg-[#161720] border border-white/[0.06] hover:border-purple-500/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-purple-950 text-purple-400 text-[10px] font-bold flex items-center justify-center shrink-0">#${i + 1}</span>
            <span class="text-xs font-bold text-white">${t.topic}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 shrink-0">${t.expected_interest || 'Спрос: Высокий'}</span>
          </div>
          <p class="text-[11px] text-slate-400 pl-7">${t.demand_reason}</p>
        </div>
        <button onclick="transferTopicToScriptStudio('${safeTopic}')" class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors shrink-0 self-start sm:self-auto">
          <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
          <span>В сценарный цех</span>
        </button>
      </div>
    `;
  });

  // 2. Questions HTML
  let questionsHtml = '';
  questions.forEach(q => {
    questionsHtml += `
      <div class="p-3 rounded-lg bg-[#161720] border border-white/[0.06] space-y-1.5">
        <div class="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
          <i data-lucide="help-circle" class="w-3.5 h-3.5 shrink-0 text-amber-400"></i>
          <span>${q.question}</span>
        </div>
        <div class="text-[11px] text-slate-300 pl-5 border-l border-amber-500/30">
          <b class="text-slate-400 font-normal">Как ответить:</b> ${q.solution}
        </div>
      </div>
    `;
  });

  // 3. Emotional Triggers HTML
  let posTriggersHtml = (triggers.positive || []).map(p => `
    <li class="flex items-start gap-1.5 text-xs text-emerald-300">
      <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></i>
      <span>${p}</span>
    </li>
  `).join('');

  let contTriggersHtml = (triggers.controversial || []).map(c => `
    <li class="flex items-start gap-1.5 text-xs text-rose-300">
      <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5"></i>
      <span>${c}</span>
    </li>
  `).join('');

  // 4. Viral Hooks HTML
  let hooksHtml = '';
  hooks.forEach(h => {
    const safeHook = h.replace(/'/g, "\\'");
    hooksHtml += `
      <div class="p-2.5 rounded-lg bg-[#161720] border border-white/[0.06] flex items-center justify-between gap-3 text-xs">
        <span class="text-slate-200 italic font-mono font-medium">${h}</span>
        <button onclick="copyToClipboard('${safeHook}')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold shrink-0">
          Копировать
        </button>
      </div>
    `;
  });

  // 5. Sample Comments List
  let commentsListHtml = '';
  sampleComments.forEach(c => {
    commentsListHtml += `
      <div class="p-2.5 rounded-lg bg-[#12131b] border border-white/[0.04] text-xs space-y-1">
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-medium text-slate-300">${c.author}</span>
          <span class="font-mono text-emerald-400 font-semibold">${c.likes} 👍</span>
        </div>
        <p class="text-slate-300 leading-relaxed">${c.text}</p>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Video Summary Header -->
      <div class="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 to-blue-950/30 border border-purple-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">
            <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
            <span>Анализ ${data.comments_count} комментариев зрителей</span>
          </div>
          <h3 class="text-base font-bold text-white">${data.video_title}</h3>
          <p class="text-xs text-slate-300 mt-1 leading-relaxed">${a.summary || ''}</p>
        </div>
      </div>

      <!-- Grid 1: Top Future Topics & Confusion Points -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Future Topics -->
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-white flex items-center gap-2">
              <i data-lucide="sparkles" class="w-4 h-4 text-purple-400"></i>
              О чем умоляют снять следующее видео
            </h4>
            <span class="text-[11px] text-purple-400 font-semibold">${topics.length} идей</span>
          </div>
          <p class="text-xs text-slate-400">Скрытый спрос, выявленный напрямую из зрительских вопросов</p>
          <div class="space-y-2.5 pt-2">
            ${topicsHtml}
          </div>
        </div>

        <!-- Questions & Misunderstandings -->
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="help-circle" class="w-4 h-4 text-amber-400"></i>
            Главные вопросы и непонимания зрителей
          </h4>
          <p class="text-xs text-slate-400">Темы, которые нужно закрыть в начале вашего ролика, чтобы снять возражения</p>
          <div class="space-y-2.5 pt-2">
            ${questionsHtml}
          </div>
        </div>

      </div>

      <!-- Grid 2: Emotional Triggers & Viral Hooks -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Emotional Triggers -->
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="heart" class="w-4 h-4 text-rose-400"></i>
            Что вызвало восторг vs Хейт и споры
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div class="space-y-2 p-3 rounded-lg bg-[#161720] border border-emerald-500/20">
              <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Восторг аудитории:</div>
              <ul class="space-y-1.5">${posTriggersHtml || '<li class="text-xs text-slate-500 italic">Нет явных восторгов</li>'}</ul>
            </div>
            <div class="space-y-2 p-3 rounded-lg bg-[#161720] border border-rose-500/20">
              <div class="text-[11px] font-bold uppercase tracking-wider text-rose-400">Споры и критика:</div>
              <ul class="space-y-1.5">${contTriggersHtml || '<li class="text-xs text-slate-500 italic">Споров не обнаружено</li>'}</ul>
            </div>
          </div>
        </div>

        <!-- 3 Viral Hooks for Next Video -->
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="zap" class="w-4 h-4 text-emerald-400"></i>
            Готовые хуки для вашего следующего ролика
          </h4>
          <p class="text-xs text-slate-400">Сформулированы на основе реального языка зрителей</p>
          <div class="space-y-2 pt-2">
            ${hooksHtml}
          </div>
        </div>

      </div>

      <!-- Sample Comments Accordion -->
      <details class="bg-[#12131b] border border-white/[0.08] rounded-xl p-4 group">
        <summary class="cursor-pointer text-xs font-bold text-slate-300 flex items-center justify-between select-none">
          <span class="flex items-center gap-2">
            <i data-lucide="message-circle" class="w-4 h-4 text-slate-400"></i>
            Посмотреть проанализированные комментарии зрителей (${sampleComments.length})
          </span>
          <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform"></i>
        </summary>
        <div class="space-y-2 pt-3">
          ${commentsListHtml}
        </div>
      </details>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function transferTopicToScriptStudio(topic) {
  if (typeof switchHub === 'function') {
    switchHub('ai_hub', 'scripts_studio');
  }
  const input = document.getElementById('scriptTopicInput');
  if (input) {
    input.value = topic;
    input.scrollIntoView({ behavior: 'smooth' });
    showToast(`Тема «${topic.slice(0, 30)}...» перенесена в Сценарный цех! Нажмите «Сгенерировать сценарий»`);
  }
}

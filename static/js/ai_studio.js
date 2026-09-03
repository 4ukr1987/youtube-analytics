/**
 * AI Growth Studio (Titles, Ideas, SEO Metadata) Module
 */

function prefillAITitle(topic) {
  switchTab('ai_studio');
  document.getElementById('aiTopicInput').value = topic;
  generateAITitles();
}

async function generateAITitles() {
  const topic = document.getElementById('aiTopicInput').value.trim();
  const audience = document.getElementById('aiAudienceInput').value.trim();
  if (!topic) return;

  setLoading(true);
  const container = document.getElementById('aiResultsContainer');
  if (container) container.innerHTML = '';

  try {
    const res = await fetch('/api/ai/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, audience })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка генерации заголовков");

    renderAITitles(data.titles || []);
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div class="p-5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs">
          ${err.message}
        </div>
      `;
    }
  } finally {
    setLoading(false);
    if (window.lucide) lucide.createIcons();
  }
}

function renderAITitles(titles) {
  const container = document.getElementById('aiResultsContainer');
  if (!container) return;

  if (titles.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">Не удалось сгенерировать заголовки</div>';
    return;
  }

  let cardsHtml = '';
  titles.forEach(t => {
    cardsHtml += `
      <div class="p-4 rounded-xl bg-bg-card border border-bg-border hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/60 text-blue-300 border border-blue-800/60 uppercase">${t.style}</span>
            <span class="text-xs text-slate-400 font-mono">Прогноз CTR: <b class="text-emerald-400">${t.predicted_ctr_tier}</b></span>
          </div>
          <h4 class="text-sm font-bold text-white leading-snug">${t.title}</h4>
          <p class="text-xs text-slate-400">${t.rationale}</p>
        </div>

        <button onclick="copyToClipboard('${t.title.replace(/'/g, "\\'")}', 'Заголовок скопирован!')" class="px-3 py-1.5 bg-bg-input hover:bg-slate-800 text-slate-200 text-xs rounded-lg border border-bg-border transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0">
          <i data-lucide="copy" class="w-3.5 h-3.5 text-blue-400"></i>
          <span>Копировать</span>
        </button>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="fade-in space-y-3">
      <div class="font-semibold text-xs text-slate-400 uppercase">Сгенерированные варианты:</div>
      ${cardsHtml}
    </div>
  `;
}

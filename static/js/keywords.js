/**
 * Keyword Research Lab & SEO Insights Module
 */

function analyzeKeywordSearch() {
  const val = document.getElementById('keywordSearchInput').value.trim();
  if (val) loadKeywordAnalysis(val);
}

async function loadKeywordAnalysis(keyword) {
  setLoading(true);
  const container = document.getElementById('keywordResultsContainer');
  if (!container) return;
  container.innerHTML = '';

  try {
    const res = await fetch(`/api/keywords?q=${encodeURIComponent(keyword)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка при исследовании ключевого слова");

    renderKeywordAnalysis(data.data);
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

function renderKeywordAnalysis(kw) {
  const container = document.getElementById('keywordResultsContainer');
  if (!container) return;

  // Render related keywords chips
  let relatedChipsHtml = '';
  if (kw.related_keywords && kw.related_keywords.length > 0) {
    kw.related_keywords.forEach(rk => {
      relatedChipsHtml += `
        <button onclick="loadKeywordAnalysis('${rk.replace(/'/g, "\\'")}')" class="tag-chip hover:bg-slate-700 transition-colors">
          <i data-lucide="search" class="w-3 h-3 text-slate-400"></i>
          <span>${rk}</span>
        </button>
      `;
    });
  } else {
    relatedChipsHtml = '<span class="text-xs text-slate-500">Похожие фразы не найдены</span>';
  }

  // Render top ranking videos
  let topVideosHtml = '';
  if (kw.top_ranking_videos && kw.top_ranking_videos.length > 0) {
    kw.top_ranking_videos.forEach(tv => {
      topVideosHtml += `
        <div class="p-3 rounded-lg bg-bg-input border border-bg-border flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
          <div class="min-w-0">
            <span class="text-xs font-semibold text-white truncate block">${tv.title}</span>
            <span class="text-[10px] text-slate-400">${tv.channel} • ${tv.views.toLocaleString()} просмотров • ${tv.published_at.slice(0, 10)}</span>
          </div>
          <button onclick="quickInspectVideo('${tv.id}')" class="btn-primary text-xs shrink-0">
            <span>Аудит</span>
          </button>
        </div>
      `;
    });
  }

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Scores Row -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-2">
          <div class="text-xs font-semibold uppercase text-slate-400 flex items-center justify-between">
            <span>Поисковый объем</span>
            <i data-lucide="search" class="w-4 h-4 text-blue-400"></i>
          </div>
          <div class="text-2xl font-bold font-mono text-white">${kw.search_volume_score} <span class="text-xs font-normal text-slate-400">/ 100</span></div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="bg-blue-500 h-full rounded-full" style="width: ${kw.search_volume_score}%"></div>
          </div>
        </div>

        <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-2">
          <div class="text-xs font-semibold uppercase text-slate-400 flex items-center justify-between">
            <span>Конкуренция в выдаче</span>
            <i data-lucide="shield-alert" class="w-4 h-4 text-amber-400"></i>
          </div>
          <div class="text-2xl font-bold font-mono text-amber-400">${kw.competition_score} <span class="text-xs font-normal text-slate-400">/ 100</span></div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="bg-amber-500 h-full rounded-full" style="width: ${kw.competition_score}%"></div>
          </div>
        </div>

        <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-2">
          <div class="text-xs font-semibold uppercase text-slate-400 flex items-center justify-between">
            <span>Индекс возможности (Opportunity)</span>
            <i data-lucide="sparkles" class="w-4 h-4 text-emerald-400"></i>
          </div>
          <div class="text-2xl font-bold font-mono text-emerald-400">${kw.overall_opportunity_score} <span class="text-xs font-normal text-slate-400">/ 100</span></div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="bg-emerald-500 h-full rounded-full" style="width: ${kw.overall_opportunity_score}%"></div>
          </div>
        </div>
      </div>

      <!-- Autocomplete & Related Phrases -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-3">
        <h4 class="font-bold text-sm text-white flex items-center gap-2">
          <i data-lucide="corner-down-right" class="w-4 h-4 text-indigo-400"></i>
          Поисковые подсказки YouTube (YouTube Autocomplete)
        </h4>
        <div class="flex flex-wrap gap-2 pt-1">
          ${relatedChipsHtml}
        </div>
      </div>

      <!-- Top Ranking Videos for this Keyword -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-3">
        <h4 class="font-bold text-sm text-white flex items-center gap-2">
          <i data-lucide="trophy" class="w-4 h-4 text-amber-400"></i>
          Топ роликов в выдаче по запросу
        </h4>
        <div class="space-y-2 pt-1">
          ${topVideosHtml}
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

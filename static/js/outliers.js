/**
 * Outliers Hunter & Virality Detector Module (1of10 & ViewStats Grade)
 */

let currentOutlierMode = 'niche'; // 'niche' | 'channel'
let cachedOutlierItems = [];

function switchOutlierMode(mode) {
  currentOutlierMode = mode;
  const nicheBtn = document.getElementById('outlierMode_niche');
  const chanBtn = document.getElementById('outlierMode_channel');
  const input = document.getElementById('outlierSearchInput');
  const filtersRow = document.getElementById('outlierFiltersRow');

  if (mode === 'niche') {
    if (nicheBtn) nicheBtn.classList.add('active');
    if (chanBtn) chanBtn.classList.remove('active');
    if (input) input.placeholder = "Тема/Ниша (напр. Искусственный интеллект, Криптовалюта, Гейминг)...";
    if (filtersRow) filtersRow.classList.remove('hidden');
  } else {
    if (chanBtn) chanBtn.classList.add('active');
    if (nicheBtn) nicheBtn.classList.remove('active');
    if (input) input.placeholder = "@handle канала (напр. @veritasium) или ссылка на канал...";
    if (filtersRow) filtersRow.classList.add('hidden');
  }
}

function handleOutliersSubmit(e) {
  if (e) e.preventDefault();
  const val = document.getElementById('outlierSearchInput').value.trim();
  if (!val) return;

  if (currentOutlierMode === 'niche') {
    loadNicheOutliers(val);
  } else {
    loadChannelOutliers(val);
  }
}

async function loadNicheOutliers(topic) {
  setLoading(true);
  const container = document.getElementById('outlierResultsContainer');
  if (!container) return;
  container.innerHTML = '';

  const minMult = parseFloat(document.getElementById('outlierMultiplierFilter')?.value || "2.0");
  const subsVal = document.getElementById('outlierSubsFilter')?.value;
  const maxSubs = (subsVal && subsVal !== 'all') ? parseInt(subsVal, 10) : null;

  try {
    let url = `/api/outliers/niche?topic=${encodeURIComponent(topic)}&min_multiplier=${minMult}&limit=35`;
    if (maxSubs) url += `&max_subs=${maxSubs}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка при поиске аномалий по нише");

    cachedOutlierItems = data.outliers || [];
    renderNicheOutliersView(topic, cachedOutlierItems);
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

function applyOutlierClientFilters() {
  if (currentOutlierMode === 'niche' && cachedOutlierItems.length) {
    const topic = document.getElementById('outlierSearchInput').value.trim() || "Ниша";
    renderNicheOutliersView(topic, cachedOutlierItems);
  }
}

function renderNicheOutliersView(topic, outliers) {
  const container = document.getElementById('outlierResultsContainer');
  if (!container) return;

  const minMult = parseFloat(document.getElementById('outlierMultiplierFilter')?.value || "2.0");
  const subsVal = document.getElementById('outlierSubsFilter')?.value;
  const maxSubs = (subsVal && subsVal !== 'all') ? parseInt(subsVal, 10) : null;
  const sortBy = document.getElementById('outlierSortFilter')?.value || "multiplier";

  // Filter client-side
  let filtered = outliers.filter(item => {
    if (item.multiplier < minMult) return false;
    if (maxSubs && item.channel_subscribers > maxSubs) return false;
    return true;
  });

  // Sort
  if (sortBy === 'multiplier') {
    filtered.sort((a, b) => b.multiplier - a.multiplier);
  } else if (sortBy === 'vph') {
    filtered.sort((a, b) => b.vph - a.vph);
  } else if (sortBy === 'views') {
    filtered.sort((a, b) => b.views - a.views);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center bg-bg-card border border-bg-border rounded-xl space-y-2">
        <i data-lucide="inbox" class="w-8 h-8 text-slate-500 mx-auto"></i>
        <p class="text-xs text-slate-400">По теме «${topic}» с выбранными фильтрами аномалий не найдено. Попробуйте уменьшить порог множителя или изменить запрос.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let cardsHtml = '';
  filtered.forEach(v => {
    let badgeClass = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
    if (v.tier === 'MEGA') {
      badgeClass = 'bg-rose-950/70 text-rose-300 border-rose-700/80 font-black';
    } else if (v.tier === 'HIGH') {
      badgeClass = 'bg-amber-950/70 text-amber-300 border-amber-700/80 font-bold';
    }

    const payloadStr = JSON.stringify({
      title: v.title,
      channel: v.channel_title,
      views: v.views,
      multiplier: v.multiplier
    }).replace(/"/g, '&quot;');

    cardsHtml += `
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4 hover:border-slate-700 transition-all duration-300 shadow-sm">
        
        <!-- Header status bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded text-xs font-mono ${badgeClass} border flex items-center gap-1">
              <span>${v.tier_badge} (x${v.multiplier})</span>
            </span>
            <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-blue-400 text-xs font-mono font-semibold flex items-center gap-1">
              <i data-lucide="zap" class="w-3 h-3"></i>
              <span>${v.vph.toLocaleString()} VPH</span>
            </span>
          </div>

          <span class="text-[11px] font-mono text-slate-400">Опубликовано: ${v.published_at.slice(0, 10)}</span>
        </div>

        <!-- Video + Channel Body -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div class="md:col-span-4 rounded-lg overflow-hidden aspect-video bg-bg-input border border-bg-border relative group">
            <img src="${v.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Thumbnail">
            <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/85 rounded text-[10px] font-mono text-white">${v.duration_formatted}</span>
          </div>

          <div class="md:col-span-8 space-y-2.5">
            <h4 class="text-sm md:text-base font-bold text-white leading-snug">
              <a href="${v.url}" target="_blank" class="hover:text-amber-400 transition-colors">${v.title}</a>
            </h4>

            <!-- Channel Profile info -->
            <div class="flex items-center gap-2.5 text-xs text-slate-400">
              <img src="${v.channel_thumbnail || ''}" class="w-5 h-5 rounded-full object-cover bg-slate-800" alt="Avatar">
              <button onclick="quickChannelAudit('${v.channel_id}')" class="text-slate-300 hover:text-white font-semibold">${v.channel_title}</button>
              <span>•</span>
              <span class="font-mono text-slate-400">${v.channel_subscribers.toLocaleString()} подписчиков</span>
            </div>

            <!-- Stats strip -->
            <div class="grid grid-cols-3 gap-2 text-xs pt-1">
              <div class="p-2 rounded-lg bg-bg-input border border-bg-border">
                <span class="text-slate-400 text-[10px] uppercase block font-medium">Просмотры</span>
                <span class="font-bold text-white font-mono text-sm">${v.views.toLocaleString()}</span>
              </div>
              <div class="p-2 rounded-lg bg-bg-input border border-bg-border">
                <span class="text-slate-400 text-[10px] uppercase block font-medium">Норма канала</span>
                <span class="font-bold text-slate-400 font-mono text-sm">~${v.baseline_views.toLocaleString()}</span>
              </div>
              <div class="p-2 rounded-lg bg-bg-input border border-bg-border">
                <span class="text-slate-400 text-[10px] uppercase block font-medium">Множитель</span>
                <span class="font-bold text-emerald-400 font-mono text-sm">x${v.multiplier} ВЫШЕ</span>
              </div>
            </div>

            <!-- Action buttons: AI Breakdown & Remix -->
            <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-bg-border/60">
              <button onclick="openViralBreakdown('${v.title.replace(/'/g, "\\'")}', '${v.channel_title.replace(/'/g, "\\'")}', ${v.views}, ${v.multiplier})" class="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5">
                <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-400"></i>
                <span>✨ AI-Разбор виральности</span>
              </button>

              <button onclick="remixOutlierIdea('${v.title.replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-bg-input hover:bg-slate-800 text-slate-200 border border-bg-border rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5">
                <i data-lucide="wand-2" class="w-3.5 h-3.5 text-purple-400"></i>
                <span>🪄 Адаптировать под меня</span>
              </button>

              <button onclick="quickExtractTranscript('${v.id}')" class="px-2.5 py-1.5 bg-bg-input hover:bg-slate-800 text-sky-400 border border-bg-border rounded-lg text-xs transition-colors" title="Открыть стенограмму">
                <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  });

  container.innerHTML = `
    <div class="fade-in space-y-4">
      <div class="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i data-lucide="flame" class="w-4 h-4 text-amber-400 shrink-0"></i>
          <span>Найдено <b>${filtered.length}</b> виральных видео-аномалий по нише «<b>${topic}</b>»</span>
        </div>
        <span class="font-mono text-[11px] text-amber-400/80">Порог: &gt;${minMult}x</span>
      </div>

      <div class="space-y-4">
        ${cardsHtml}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

async function loadChannelOutliers(channelInput) {
  setLoading(true);
  const container = document.getElementById('outlierResultsContainer');
  if (!container) return;
  container.innerHTML = '';

  try {
    const res = await fetch(`/api/channel?q=${encodeURIComponent(channelInput)}&limit=50`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка при поиске аномалий канала");

    const outliers = (data.analytics?.outliers || []).map(o => ({
      ...o,
      channel_id: data.overview?.id,
      channel_title: data.overview?.title,
      channel_thumbnail: data.overview?.thumbnail,
      channel_subscribers: data.overview?.subscribers,
      baseline_views: Math.round(data.analytics?.views_distribution?.median || 500),
      tier: o.multiplier >= 10.0 ? "MEGA" : (o.multiplier >= 5.0 ? "HIGH" : "SOLID"),
      tier_badge: o.multiplier >= 10.0 ? "🚀 MEGA OUTLIER" : (o.multiplier >= 5.0 ? "⚡ HIGH OUTLIER" : "✨ SOLID OUTLIER")
    }));

    cachedOutlierItems = outliers;
    renderNicheOutliersView(data.overview?.title || "Канал", outliers);
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-xs text-rose-400 bg-rose-950/20 border border-rose-800/40 rounded-xl">${err.message}</div>`;
  } finally {
    setLoading(false);
    if (window.lucide) lucide.createIcons();
  }
}

// -------------------------------------------------------------
// AI Viral Breakdown Modal
// -------------------------------------------------------------
async function openViralBreakdown(title, channel, views, multiplier) {
  const modal = document.getElementById('viralBreakdownModal');
  const content = document.getElementById('viralBreakdownContent');
  if (!modal || !content) return;

  modal.classList.remove('hidden');
  content.innerHTML = `
    <div class="py-12 text-center space-y-3">
      <div class="w-8 h-8 rounded-full border-2 border-slate-700 border-t-amber-500 animate-spin mx-auto"></div>
      <p class="text-xs text-slate-400">Gemini анализирует психологию клика и алгоритмический триггер...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/outliers/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        channel_title: channel,
        views,
        multiplier
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    const b = data.breakdown;
    let whyListHtml = '';
    (b.why_it_worked || []).forEach(w => {
      whyListHtml += `
        <li class="flex items-start gap-2 text-xs text-slate-300">
          <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></i>
          <span>${w}</span>
        </li>
      `;
    });

    content.innerHTML = `
      <div class="space-y-4 fade-in">
        <!-- Target Video Overview -->
        <div class="p-4 rounded-xl bg-bg-input border border-bg-border space-y-1">
          <div class="text-[10px] uppercase font-bold text-amber-400">Разбираемое видео (${multiplier}x от нормы):</div>
          <h4 class="text-sm font-bold text-white">"${title}"</h4>
          <span class="text-xs text-slate-400 font-mono">Канал: ${channel} • ${views.toLocaleString()} просмотров</span>
        </div>

        <!-- Trigger Badge -->
        <div class="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-1">
          <span class="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
            <i data-lucide="zap" class="w-3 h-3"></i>
            <span>Главный психологический триггер:</span>
          </span>
          <p class="text-xs text-amber-200 font-semibold">${b.trigger}</p>
        </div>

        <!-- 3 Algorithmic Reasons -->
        <div class="p-4 rounded-xl bg-bg-input border border-bg-border space-y-2">
          <span class="text-[10px] uppercase font-bold text-blue-400 flex items-center gap-1">
            <i data-lucide="activity" class="w-3 h-3"></i>
            <span>Почему алгоритм YouTube дал показы:</span>
          </span>
          <ul class="space-y-1.5 pt-1">
            ${whyListHtml}
          </ul>
        </div>

        <!-- Thumbnail Idea -->
        <div class="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/50 space-y-1">
          <span class="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1">
            <i data-lucide="image" class="w-3 h-3"></i>
            <span>Визуальная формула превью:</span>
          </span>
          <p class="text-xs text-purple-200">${b.thumbnail_concept}</p>
        </div>

        <!-- Action Recipe -->
        <div class="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-1.5">
          <span class="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
            <i data-lucide="flame" class="w-3 h-3"></i>
            <span>Как снять свой ролик на эту тему:</span>
          </span>
          <p class="text-xs text-emerald-200 leading-relaxed">${b.remix_recipe}</p>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button onclick="remixOutlierIdea('${title.replace(/'/g, "\\'")}')" class="btn-amber text-xs">
            <i data-lucide="wand-2" class="w-3.5 h-3.5"></i>
            <span>Адаптировать под мой канал</span>
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    content.innerHTML = `<div class="p-4 text-xs text-rose-400">${err.message}</div>`;
  }
}

function closeViralBreakdownModal() {
  const modal = document.getElementById('viralBreakdownModal');
  if (modal) modal.classList.add('hidden');
}

async function remixOutlierIdea(title) {
  closeViralBreakdownModal();
  switchHub('ai_hub', 'ai_studio');
  const input = document.getElementById('aiTopicInput');
  if (input) input.value = title;
  generateAITitles();
  showToast("Тема перенесена в AI Studio для генерации адаптаций!");
}

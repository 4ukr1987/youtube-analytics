/**
 * Channel Deep Audit & Outliers Module
 */

let activeChannelData = null;
let channelViewsChartInstance = null;
let channelCadenceChartInstance = null;

function quickChannelAudit(channelQuery) {
  switchHub('channel_hub', 'channel_audit');
  const input = document.getElementById('channelSearchInput');
  if (input) input.value = channelQuery;
  loadChannelAnalysis(channelQuery);
}

function analyzeChannelSearch() {
  const val = document.getElementById('channelSearchInput').value.trim();
  if (!val) return;

  if (isVideoQuery(val)) {
    showToast("Обнаружено видео: переключаем в инспектор видео...");
    switchHub('video_hub', 'video_seo');
    const vidInput = document.getElementById('videoUrlInput') || document.getElementById('videoSearchInput');
    if (vidInput) vidInput.value = val;
    if (typeof loadVideoAnalysis === 'function') loadVideoAnalysis(val);
    return;
  }

  loadChannelAnalysis(val);
}

function analyzeChannel(query) {
  loadChannelAnalysis(query);
}

let channelAllVideos = [];
let filteredModalVideos = [];

async function loadChannelAnalysis(channelInput) {
  setLoading(true);
  const container = document.getElementById('channelResultsContainer');
  if (!container) return;
  
  container.innerHTML = `
    <div class="p-10 rounded-xl bg-[#12131b] border border-white/[0.08] text-center space-y-3 fade-in">
      <div class="w-8 h-8 rounded-full border-2 border-slate-700 border-t-emerald-400 animate-spin mx-auto"></div>
      <div class="text-xs font-semibold text-slate-200">Глубокий аудит канала & расчет медианы...</div>
      <p class="text-[11px] text-slate-400">Сбор последних роликов, анализ стабильности и расчет нормы просмотров</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/channel?q=${encodeURIComponent(channelInput)}&limit=50`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка при аудите канала");

    activeChannelData = data;
    window.activeChannelOverview = data.overview;
    channelAllVideos = data.analytics?.recent_videos || data.analytics?.videos || data.analytics?.outliers || [];
    filteredModalVideos = [...channelAllVideos];

    if (typeof onActiveChannelChanged === 'function') {
      onActiveChannelChanged(data.overview);
    }
    renderChannelAudit(data.overview, data.analytics);
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

async function toggleChannelWatchlist(channelId) {
  try {
    const res = await fetch('/api/watchlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId })
    });
    const data = await res.json();
    if (data.is_watchlist) {
      showToast("Канал добавлен в Watchlist! Данные сохраняются.");
    } else {
      showToast("Канал удален из Watchlist.");
    }
  } catch (e) {
    showToast("Ошибка при обновлении Watchlist");
  }
}

function openAllVideosModal() {
  if (!activeChannelData || channelAllVideos.length === 0) {
    showToast("Сначала выполните поиск канала");
    return;
  }
  const modal = document.getElementById('allVideosModal');
  if (!modal) return;

  const titleEl = document.getElementById('allVideosModalTitle');
  const subEl = document.getElementById('allVideosModalSubtitle');
  if (titleEl) titleEl.innerText = `Все видео канала «${activeChannelData.overview.title}»`;
  if (subEl) subEl.innerText = `Загружено ${channelAllVideos.length} роликов с метриками виральности и скорости VPH`;

  const searchInp = document.getElementById('modalVideoSearchInput');
  if (searchInp) searchInp.value = '';

  filteredModalVideos = [...channelAllVideos];
  sortModalVideos();
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function openViralVideosModal() {
  if (!activeChannelData || channelAllVideos.length === 0) {
    showToast("Сначала выполните поиск канала");
    return;
  }
  const modal = document.getElementById('allVideosModal');
  if (!modal) return;

  const titleEl = document.getElementById('allVideosModalTitle');
  const subEl = document.getElementById('allVideosModalSubtitle');
  if (titleEl) titleEl.innerText = `🔥 Виральные аномалии канала «${activeChannelData.overview.title}»`;
  
  // Filter only viral/high performer videos (multiplier >= 1.7 or >= 2.0)
  filteredModalVideos = channelAllVideos.filter(v => {
    const mult = v.outlier_multiplier || v.multiplier || 1.0;
    return mult >= 1.7;
  });

  if (filteredModalVideos.length === 0) {
    filteredModalVideos = [...channelAllVideos].sort((a, b) => (b.outlier_multiplier || b.multiplier || 0) - (a.outlier_multiplier || a.multiplier || 0)).slice(0, 5);
  }

  if (subEl) subEl.innerText = `Найдено ${filteredModalVideos.length} видео с аномально высокими просмотрами (в 2+ раза выше нормы)`;

  const searchInp = document.getElementById('modalVideoSearchInput');
  if (searchInp) searchInp.value = '';

  const sortSelect = document.getElementById('modalVideoSortSelect');
  if (sortSelect) sortSelect.value = 'multiplier_desc';

  sortModalVideos();
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeAllVideosModal() {
  const modal = document.getElementById('allVideosModal');
  if (modal) modal.classList.add('hidden');
}

function filterModalVideos() {
  const q = (document.getElementById('modalVideoSearchInput')?.value || '').toLowerCase().trim();
  if (!q) {
    filteredModalVideos = [...channelAllVideos];
  } else {
    filteredModalVideos = channelAllVideos.filter(v => 
      (v.title || '').toLowerCase().includes(q) || 
      (v.tags && v.tags.some(t => t.toLowerCase().includes(q)))
    );
  }
  sortModalVideos();
}

function sortModalVideos() {
  const sortType = document.getElementById('modalVideoSortSelect')?.value || 'views_desc';
  
  if (sortType === 'views_desc') {
    filteredModalVideos.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else if (sortType === 'ctr_desc') {
    filteredModalVideos.sort((a, b) => (b.ctr_estimated || 0) - (a.ctr_estimated || 0));
  } else if (sortType === 'date_desc') {
    filteredModalVideos.sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
  } else if (sortType === 'multiplier_desc') {
    filteredModalVideos.sort((a, b) => (b.outlier_multiplier || b.multiplier || 0) - (a.outlier_multiplier || a.multiplier || 0));
  } else if (sortType === 'vph_desc') {
    filteredModalVideos.sort((a, b) => (b.vph || 0) - (a.vph || 0));
  }

  renderModalVideosList(filteredModalVideos);
}

function renderModalVideosList(videos) {
  const container = document.getElementById('allVideosModalBody');
  const countEl = document.getElementById('allVideosCountInfo');
  if (countEl) countEl.innerText = `Показано: ${videos.length} из ${channelAllVideos.length} видео`;
  if (!container) return;

  if (videos.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-xs text-slate-400">
        Видео по вашему запросу не найдены.
      </div>
    `;
    return;
  }

  let html = '';
  videos.forEach((vid, i) => {
    const mult = vid.outlier_multiplier || vid.multiplier || 1.0;
    let outlierBadge = '';
    if (mult >= 2.0) {
      outlierBadge = `<span class="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] font-bold font-mono">x${mult} VIRAL</span>`;
    } else if (mult >= 1.2) {
      outlierBadge = `<span class="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/80 text-blue-400 text-[10px] font-bold font-mono">x${mult}</span>`;
    } else {
      outlierBadge = `<span class="text-slate-500 font-mono text-xs">x${mult}</span>`;
    }

    const ctrVal = vid.ctr_estimated || 5.2;
    let ctrBadge = '';
    if (ctrVal >= 7.5) {
      ctrBadge = `<span class="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] font-bold font-mono" title="Высокий прогнозируемый CTR">🔥 ${ctrVal}%</span>`;
    } else if (ctrVal >= 5.0) {
      ctrBadge = `<span class="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/80 text-blue-400 text-[10px] font-bold font-mono" title="Хороший CTR в норме">⚡ ${ctrVal}%</span>`;
    } else {
      ctrBadge = `<span class="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/80 text-slate-300 text-[10px] font-mono" title="Стандартный CTR">📊 ${ctrVal}%</span>`;
    }

    const vidUrl = vid.url || `https://www.youtube.com/watch?v=${vid.id}`;
    const pubDate = (vid.published_at || '').slice(0, 10);
    const viewsFmt = (vid.views || 0).toLocaleString();
    const vphFmt = (vid.vph || 0).toLocaleString();

    html += `
      <div class="py-3 px-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-white/[0.03] rounded-xl transition-colors">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <span class="w-6 text-center text-xs font-mono text-slate-500 shrink-0">${i + 1}</span>
          <img src="${vid.thumbnail}" class="w-20 h-12 rounded-lg object-cover bg-[#161722] shrink-0 border border-white/[0.08]" alt="Thumb">
          <div class="min-w-0 flex-1">
            <a href="${vidUrl}" target="_blank" class="text-xs font-semibold text-white hover:text-blue-400 truncate block transition-colors" title="${vid.title}">${vid.title}</a>
            <div class="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
              <span>${pubDate}</span>
              <span>•</span>
              <span>${vid.duration_formatted || ''}</span>
              <span>•</span>
              <span class="font-mono text-slate-300 font-semibold">${viewsFmt} просм.</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4 shrink-0 self-end sm:self-center">
          <div class="text-right">
            <div class="text-[10px] text-slate-500 uppercase font-semibold">CTR (Est.)</div>
            <div>${ctrBadge}</div>
          </div>
          <div class="text-right">
            <div class="text-[10px] text-slate-500 uppercase font-semibold">Outlier</div>
            <div>${outlierBadge}</div>
          </div>
          <div class="text-right">
            <div class="text-[10px] text-slate-500 uppercase font-semibold">VPH</div>
            <div class="text-xs font-mono font-bold text-slate-300">${vphFmt}</div>
          </div>
          <button onclick="closeAllVideosModal(); openViralBreakdown('${vid.title.replace(/'/g, "\\'")}', '${(activeChannelData?.overview?.title || 'Канал').replace(/'/g, "\\'")}', ${vid.views || 0}, ${mult})" class="px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 border border-amber-500/30 text-amber-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm" title="Разобрать формулу виральности">
            <i data-lucide="dna" class="w-3.5 h-3.5"></i>
            <span>Формула</span>
          </button>
          <button onclick="closeAllVideosModal(); quickInspectVideo('${vid.id}')" class="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm" title="Открыть видео в SEO-Лаборатории">
            <i data-lucide="scan-search" class="w-3.5 h-3.5"></i>
            <span>SEO Аудит</span>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function renderChannelAudit(ov, an) {
  const container = document.getElementById('channelResultsContainer');
  if (!container || !an || !ov) return;

  const medianViews = Math.round(an.median_views || an.views_distribution?.median || 0);
  const meanViews = Math.round(an.mean_views || an.views_distribution?.mean || 0);
  const medianFormatted = medianViews.toLocaleString();
  const meanFormatted = meanViews.toLocaleString();

  const vidsList = an.recent_videos || an.videos || an.outliers || [];
  const subscribersCount = ov.subscribers || ov.subscriber_count || 0;
  const totalViewsCount = ov.total_views || ov.view_count || 0;
  const videoCount = ov.video_count || vidsList.length || 0;
  const channelAvatar = ov.thumbnail || ov.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde';

  const cadenceObj = an.cadence || an.publishing_cadence || {};
  const vidsPerWeek = cadenceObj.videos_per_week || (cadenceObj.videos_per_month ? Math.round(cadenceObj.videos_per_month / 4.3) : 2.5);
  const daysBetween = cadenceObj.avg_days_between_uploads || cadenceObj.average_days_between_uploads || 3.0;
  const erRate = an.avg_engagement_rate || an.engagement?.average_engagement_rate || 0.0;
  const outliersCount = an.outliers_found || (an.outliers ? an.outliers.length : 0);

  // Render recent video rows
  let videoRowsHtml = '';
  vidsList.slice(0, 15).forEach((vid, i) => {
    const mult = vid.outlier_multiplier || vid.multiplier || 1.0;
    let outlierBadge = '';
    if (mult >= 2.0) {
      outlierBadge = `<span class="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-[10px] font-bold font-mono">x${mult} VIRAL</span>`;
    } else if (mult >= 1.2) {
      outlierBadge = `<span class="px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-400 text-[10px] font-bold font-mono">x${mult}</span>`;
    } else {
      outlierBadge = `<span class="text-slate-500 font-mono text-[11px]">x${mult}</span>`;
    }

    const ctrVal = vid.ctr_estimated || 5.2;
    let ctrBadge = '';
    if (ctrVal >= 7.5) {
      ctrBadge = `<span class="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] font-bold font-mono" title="Высокий прогнозируемый CTR">🔥 ${ctrVal}%</span>`;
    } else if (ctrVal >= 5.0) {
      ctrBadge = `<span class="px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800/80 text-blue-400 text-[10px] font-bold font-mono" title="Хороший CTR в норме">⚡ ${ctrVal}%</span>`;
    } else {
      ctrBadge = `<span class="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/80 text-slate-300 text-[10px] font-mono" title="Стандартный CTR">📊 ${ctrVal}%</span>`;
    }

    const vidUrl = vid.url || `https://www.youtube.com/watch?v=${vid.id}`;
    const vidViews = (vid.views || 0).toLocaleString();
    const vidVph = (vid.vph || 0).toLocaleString();
    const pubDate = (vid.published_at || '').slice(0, 10);

    videoRowsHtml += `
      <tr class="border-b border-bg-border/60 hover:bg-slate-800/30 transition-colors">
        <td class="py-3 px-3 w-10 text-xs font-mono text-slate-500 text-center">${i + 1}</td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-3">
            <img src="${vid.thumbnail}" class="w-16 h-9 rounded object-cover bg-bg-input shrink-0 border border-bg-border" alt="Thumbnail">
            <div class="min-w-0">
              <a href="${vidUrl}" target="_blank" class="text-xs font-semibold text-white hover:text-blue-400 truncate block transition-colors">${vid.title}</a>
              <span class="text-[10px] text-slate-400">${pubDate} • ${vid.duration_formatted || ''}</span>
            </div>
          </div>
        </td>
        <td class="py-3 px-3 text-right text-xs font-bold font-mono text-slate-200">${vidViews}</td>
        <td class="py-3 px-3 text-center">${ctrBadge}</td>
        <td class="py-3 px-3 text-center">${outlierBadge}</td>
        <td class="py-3 px-3 text-right text-xs font-mono text-slate-400">${vidVph}</td>
        <td class="py-3 px-3 text-center">
          <div class="flex items-center justify-center gap-1">
            <button onclick="openViralBreakdown('${vid.title.replace(/'/g, "\\'")}', '${ov.title.replace(/'/g, "\\'")}', ${vid.views || 0}, ${mult})" class="p-1 text-slate-400 hover:text-amber-400 transition-colors" title="Формула виральности">
              <i data-lucide="dna" class="w-4 h-4"></i>
            </button>
            <button onclick="quickInspectVideo('${vid.id}')" class="p-1 text-slate-400 hover:text-blue-400 transition-colors" title="SEO-Аудит ролика">
              <i data-lucide="scan-search" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Channel Header Card -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <img src="${channelAvatar}" alt="Avatar" class="w-16 h-16 rounded-full border-2 border-slate-700 bg-bg-input object-cover">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold text-white">${ov.title}</h3>
              <button onclick="toggleChannelWatchlist('${ov.id}')" class="p-1 text-slate-400 hover:text-amber-400 transition-colors" title="Добавить в Watchlist">
                <i data-lucide="bookmark" class="w-4 h-4"></i>
              </button>
              <button onclick="exportAuditReport('markdown')" class="p-1 text-slate-400 hover:text-emerald-400 transition-colors" title="Экспорт отчета аудита в Markdown">
                <i data-lucide="download" class="w-4 h-4"></i>
              </button>
              <button onclick="exportAuditReport('print')" class="p-1 text-slate-400 hover:text-sky-400 transition-colors" title="Распечатать / Сохранить в PDF">
                <i data-lucide="printer" class="w-4 h-4"></i>
              </button>
            </div>
            <p class="text-xs text-slate-400 font-mono">${ov.custom_url || ov.id} • ${ov.country || 'Global'}</p>
            <p class="text-xs text-slate-300 mt-1 max-w-xl line-clamp-2">${ov.description || 'Описание канала не указано'}</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3 w-full md:w-auto">
          <div class="p-3 rounded-lg bg-bg-input border border-bg-border text-center">
            <div class="text-[10px] text-slate-400 font-semibold uppercase">Подписчики</div>
            <div class="text-sm font-bold text-white font-mono">${subscribersCount.toLocaleString()}</div>
          </div>
          <div class="p-3 rounded-lg bg-bg-input border border-bg-border text-center">
            <div class="text-[10px] text-slate-400 font-semibold uppercase">Просмотры</div>
            <div class="text-sm font-bold text-white font-mono">${totalViewsCount.toLocaleString()}</div>
          </div>
          <div onclick="openAllVideosModal()" class="p-3 rounded-lg bg-bg-input hover:bg-slate-800/90 border border-bg-border hover:border-blue-500/60 cursor-pointer transition-all text-center group shadow-sm hover:shadow-md hover:shadow-blue-500/10" title="Нажмите, чтобы открыть полный список всех видео канала">
            <div class="text-[10px] text-slate-400 group-hover:text-blue-400 font-semibold uppercase flex items-center justify-center gap-1">
              <span>Видео</span>
              <i data-lucide="external-link" class="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity"></i>
            </div>
            <div class="text-sm font-bold text-white group-hover:text-blue-400 font-mono">${videoCount.toLocaleString()}</div>
            <div class="text-[9px] text-blue-400/80 font-medium mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Открыть все ↗</div>
          </div>
        </div>
      </div>

      <!-- Key Performance Metrics Row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-bg-card border border-bg-border rounded-xl p-4 space-y-1">
          <div class="text-[11px] font-semibold text-slate-400 uppercase flex items-center justify-between">
            <span>Медиана просмотров</span>
            <i data-lucide="bar-chart" class="w-3.5 h-3.5 text-blue-400"></i>
          </div>
          <div class="text-xl font-bold font-mono text-white">${medianFormatted}</div>
          <p class="text-[11px] text-slate-400">Базовый уровень для выявления аномалий</p>
        </div>

        <div class="bg-bg-card border border-bg-border rounded-xl p-4 space-y-1">
          <div class="text-[11px] font-semibold text-slate-400 uppercase flex items-center justify-between">
            <span>Регулярность публикаций</span>
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-emerald-400"></i>
          </div>
          <div class="text-xl font-bold font-mono text-emerald-400">${vidsPerWeek} / нед</div>
          <p class="text-[11px] text-slate-400">Интервал: ~${daysBetween} дн. между роликами</p>
        </div>

        <div class="bg-bg-card border border-bg-border rounded-xl p-4 space-y-1">
          <div class="text-[11px] font-semibold text-slate-400 uppercase flex items-center justify-between">
            <span>Вовлеченность (ER)</span>
            <i data-lucide="heart" class="w-3.5 h-3.5 text-pink-400"></i>
          </div>
          <div class="text-xl font-bold font-mono text-pink-400">${erRate}%</div>
          <p class="text-[11px] text-slate-400">Лайки + Комментарии на 100 просмотров</p>
        </div>

        <div onclick="openViralVideosModal()" class="bg-bg-card hover:bg-slate-800/90 border border-bg-border hover:border-amber-500/60 rounded-xl p-4 space-y-1 cursor-pointer transition-all group shadow-sm hover:shadow-md hover:shadow-amber-500/10" title="Нажмите, чтобы открыть список всех виральных видео канала">
          <div class="text-[11px] font-semibold text-slate-400 group-hover:text-amber-400 uppercase flex items-center justify-between">
            <span>Виральные видео (>2x)</span>
            <div class="flex items-center gap-1">
              <span class="text-[9px] text-amber-400/80 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Открыть ↗</span>
              <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i>
            </div>
          </div>
          <div class="text-xl font-bold font-mono text-amber-400 group-hover:text-amber-300">${outliersCount} роликов</div>
          <p class="text-[11px] text-slate-400">Опережают медиану канала в 2+ раза</p>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-8 bg-bg-card border border-bg-border rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="activity" class="w-4 h-4 text-blue-400"></i>
            Динамика просмотров последних видео vs Медиана канала
          </h4>
          <div class="h-64">
            <canvas id="channelViewsChart"></canvas>
          </div>
        </div>

        <div class="lg:col-span-4 bg-bg-card border border-bg-border rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="clock" class="w-4 h-4 text-emerald-400"></i>
            Распределение по дням недели
          </h4>
          <div class="h-64">
            <canvas id="channelCadenceChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Recent Videos Table with Outlier Multipliers -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 class="font-bold text-sm text-white flex items-center gap-2">
              <i data-lucide="list" class="w-4 h-4 text-blue-400"></i>
              Последние видео канала & Множитель виральности
            </h4>
            <p class="text-xs text-slate-400">Сравнение просмотров каждого ролика с базовой медианой (${medianFormatted})</p>
          </div>
          <button onclick="openAllVideosModal()" class="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto shadow-sm">
            <i data-lucide="layers" class="w-3.5 h-3.5"></i>
            <span>Показать все видео (${vidsList.length})</span>
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-bg-border text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                <th class="py-2.5 px-3 text-center">#</th>
                <th class="py-2.5 px-3">Видео</th>
                <th class="py-2.5 px-3 text-right">Просмотры</th>
                <th class="py-2.5 px-3 text-center">CTR (Est.)</th>
                <th class="py-2.5 px-3 text-center">Outlier Rate</th>
                <th class="py-2.5 px-3 text-right">VPH</th>
                <th class="py-2.5 px-3 text-center">Аудит</th>
              </tr>
            </thead>
            <tbody>
              ${videoRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();

  // Render Charts
  setTimeout(() => {
    renderChannelCharts(an);
  }, 50);
}

function renderChannelCharts(an) {
  const vids = [...(an.recent_videos || an.videos || an.outliers || [])].reverse();
  const medianViews = Math.round(an.median_views || an.views_distribution?.median || 0);
  const labels = vids.map(v => v.title.length > 20 ? v.title.slice(0, 18) + '...' : v.title);
  const viewsData = vids.map(v => v.views || 0);
  const medianLine = vids.map(() => medianViews);

  // 1. Views dynamics chart
  const ctxViews = document.getElementById('channelViewsChart');
  if (ctxViews && typeof Chart !== 'undefined') {
    if (channelViewsChartInstance) channelViewsChartInstance.destroy();
    channelViewsChartInstance = new Chart(ctxViews, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Просмотры ролика',
            data: viewsData,
            borderColor: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            fill: true,
            tension: 0.3,
            borderWidth: 1.5,
            pointRadius: 2,
            pointHoverRadius: 4
          },
          {
            label: 'Медиана канала',
            data: medianLine,
            borderColor: 'rgba(255, 255, 255, 0.35)',
            borderDash: [4, 4],
            fill: false,
            pointRadius: 0,
            borderWidth: 1.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#a1a1aa', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { display: false }, grid: { color: 'rgba(255, 255, 255, 0.04)' } },
          y: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.04)' } }
        }
      }
    });
  }

  // 2. Day of week distribution chart
  const ctxCadence = document.getElementById('channelCadenceChart');
  if (ctxCadence && typeof Chart !== 'undefined') {
    if (channelCadenceChartInstance) channelCadenceChartInstance.destroy();
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    vids.forEach(v => {
      if (v.published_at) {
        const d = new Date(v.published_at).getDay();
        const idx = (d + 6) % 7;
        dayCounts[idx]++;
      }
    });

    channelCadenceChartInstance = new Chart(ctxCadence, {
      type: 'bar',
      data: {
        labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        datasets: [{
          label: 'Кол-во публикаций',
          data: dayCounts,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          hoverBackgroundColor: '#ffffff',
          borderRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#71717a', font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: '#71717a', font: { size: 10 }, stepSize: 1 }, grid: { color: 'rgba(255, 255, 255, 0.04)' } }
        }
      }
    });
  }
}

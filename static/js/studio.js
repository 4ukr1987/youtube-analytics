/**
 * YouTube Studio Pro Analytics & Google OAuth Module
 */

let studioRetentionChartInstance = null;
let studioTimelineChartInstance = null;
let currentOAuthUser = null;
let currentStudioTimeRange = "28d";

document.addEventListener('DOMContentLoaded', () => {
  initOAuthState();
  checkOAuthRedirectParams();
});

function checkOAuthRedirectParams() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('oauth') === 'success') {
    showToast("🎉 Вы успешно подключили свой YouTube канал через Google OAuth!");
    window.history.replaceState({}, document.title, window.location.pathname);
    initOAuthState();
    loadStudioAnalyticsView();
  } else if (urlParams.get('oauth_error')) {
    showToast("Ошибка авторизации: " + urlParams.get('oauth_error'));
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

async function initOAuthState() {
  try {
    const res = await fetch('/api/oauth/status');
    const data = await res.json();
    if (!res.ok) return;

    const btn = document.getElementById('headerOAuthBtn');
    const textSpan = document.getElementById('headerOAuthText');
    const myChannelBtn = document.getElementById('channelHubMyChannelBtn');

    if (data.is_authenticated && data.channel && data.channel.has_channel) {
      currentOAuthUser = data.channel;
      if (textSpan) {
        textSpan.innerHTML = `
          <span class="flex items-center gap-1.5 text-white font-semibold">
            ${data.channel.avatar ? `<img src="${data.channel.avatar}" class="w-4 h-4 rounded-full border border-emerald-400">` : ''}
            <span class="truncate max-w-[120px]">${data.channel.title}</span>
          </span>
        `;
      }
      if (btn) {
        btn.classList.add('border-emerald-500/50', 'bg-emerald-950/40');
        btn.title = `Подключен канал: ${data.channel.title} (${data.channel.subscribers.toLocaleString()} подписчиков). Кликните для меню`;
      }
      if (myChannelBtn) {
        myChannelBtn.classList.remove('hidden');
      }
    } else {
      currentOAuthUser = null;
      if (textSpan) textSpan.textContent = "Google OAuth";
      if (btn) {
        btn.classList.remove('border-emerald-500/50', 'bg-emerald-950/40');
        btn.title = "Войти через Google Аккаунт для анализа своего канала";
      }
      if (myChannelBtn) {
        myChannelBtn.classList.add('hidden');
      }
    }
  } catch (err) {
    console.warn("OAuth status check error:", err);
  }
}

async function loadStudioAnalyticsView(timeRange = null) {
  if (timeRange) currentStudioTimeRange = timeRange;
  const container = document.getElementById('studioAnalyticsContainer') || document.getElementById('studioDashboardContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
      <div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <span>Загрузка расширенной аналитики YouTube Studio (период: ${currentStudioTimeRange})...</span>
    </div>
  `;

  try {
    const res = await fetch(`/api/studio/analytics?time_range=${currentStudioTimeRange}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Не удалось загрузить данные');

    renderStudioAnalytics(data.studio);
  } catch (err) {
    container.innerHTML = `
      <div class="p-5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-400"></i>
        <span>${err.message}</span>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

function renderStudioAnalytics(st) {
  const container = document.getElementById('studioAnalyticsContainer') || document.getElementById('studioDashboardContainer');
  if (!container) return;

  const imp = st.impressions_data || { impressions: 0, impressions_ctr: 0, views_from_impressions: 0, avg_view_duration_formatted: '0:00', watch_time_hours: 0, likes: 0 };
  const ret = st.retention_analysis || { hook_retention_30s: 0, avg_retention_pct: 0, drop_off_point: '' };
  const subStatus = st.subscription_status || { subscribed: { views: 0, percent: 0, avg_sec: 0 }, unsubscribed: { views: 0, percent: 0, avg_sec: 0 } };

  // Traffic sources bars
  let trafficHtml = '';
  if (st.traffic_sources && st.traffic_sources.length > 0) {
    st.traffic_sources.forEach(src => {
      trafficHtml += `
        <div class="space-y-1">
          <div class="flex justify-between text-xs font-medium text-slate-300">
            <span>${src.source}</span>
            <span class="font-mono text-emerald-400 font-semibold">${src.percent}% (${src.views.toLocaleString()} просм.)</span>
          </div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="bg-emerald-500 h-full rounded-full transition-all duration-500" style="width: ${src.percent}%"></div>
          </div>
        </div>
      `;
    });
  } else {
    trafficHtml = '<div class="text-xs text-slate-500 italic">Нет данных по источникам трафика за этот период</div>';
  }

  // Geography bars
  let geoHtml = '';
  if (st.geography && st.geography.length > 0) {
    st.geography.forEach(g => {
      geoHtml += `
        <div class="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.04] last:border-0">
          <div class="flex items-center gap-2 text-slate-300">
            <span class="text-base">${g.flag}</span>
            <span>${g.name}</span>
          </div>
          <div class="text-right font-mono">
            <span class="text-white font-semibold">${g.views.toLocaleString()}</span>
            <span class="text-[11px] text-slate-500 ml-1">(${g.percent}%)</span>
          </div>
        </div>
      `;
    });
  } else {
    geoHtml = '<div class="text-xs text-slate-500 italic">Нет гео-данных за выбранный период</div>';
  }

  // Device types
  let devicesHtml = '';
  if (st.devices && st.devices.length > 0) {
    st.devices.forEach(d => {
      devicesHtml += `
        <div class="p-3 rounded-lg bg-[#161720] border border-white/[0.06] flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs text-slate-300">
            <i data-lucide="${d.icon}" class="w-4 h-4 text-blue-400"></i>
            <span>${d.device}</span>
          </div>
          <div class="font-mono text-xs text-white font-bold">${d.views.toLocaleString()} <span class="text-[10px] text-emerald-400 font-normal">(${d.percent}%)</span></div>
        </div>
      `;
    });
  }

  // Search queries list
  let searchTermsHtml = '';
  if (st.search_terms && st.search_terms.length > 0) {
    st.search_terms.forEach(t => {
      searchTermsHtml += `
        <div class="flex items-center justify-between p-2 rounded-lg bg-[#161720] border border-white/[0.06] text-xs">
          <div class="flex items-center gap-2 text-slate-200">
            <i data-lucide="search" class="w-3.5 h-3.5 text-blue-400"></i>
            <span class="font-medium">${t.query}</span>
          </div>
          <div class="font-mono text-emerald-400 font-semibold">${t.views} просм.</div>
        </div>
      `;
    });
  } else {
    searchTermsHtml = '<div class="text-xs text-slate-500 italic">Нет поисковых запросов за выбранный период</div>';
  }

  // Demographics (Age / Gender)
  let demographicsHtml = '';
  if (st.demographics && st.demographics.length > 0) {
    st.demographics.forEach(dm => {
      demographicsHtml += `
        <div class="space-y-1">
          <div class="flex justify-between text-xs font-medium text-slate-300">
            <span>${dm.age} лет (${dm.gender})</span>
            <span class="font-mono text-purple-400 font-semibold">${dm.percent}%</span>
          </div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="bg-purple-500 h-full rounded-full transition-all duration-500" style="width: ${dm.percent}%"></div>
          </div>
        </div>
      `;
    });
  } else {
    demographicsHtml = '<div class="text-xs text-slate-500 italic">Недостаточно данных для демографического отчета</div>';
  }

  // Top Videos table rows
  let topVideosHtml = '';
  if (st.top_videos && st.top_videos.length > 0) {
    st.top_videos.forEach((v, idx) => {
      topVideosHtml += `
        <tr class="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
          <td class="py-2.5 px-3 text-center text-xs font-mono text-slate-500">#${idx + 1}</td>
          <td class="py-2.5 px-3">
            <div class="flex items-center gap-2.5">
              <a href="https://www.youtube.com/watch?v=${v.video_id}" target="_blank" class="shrink-0 group relative overflow-hidden rounded">
                <img src="${v.thumbnail}" class="w-16 h-9 object-cover rounded border border-white/10 group-hover:scale-105 transition-transform" />
              </a>
              <div class="min-w-0">
                <a href="https://www.youtube.com/watch?v=${v.video_id}" target="_blank" class="text-xs font-semibold text-white hover:text-blue-400 transition-colors line-clamp-1">${v.title}</a>
                <div class="text-[10px] text-slate-500 font-mono">ID: ${v.video_id} • Опубликовано: ${v.published_at || '—'}</div>
              </div>
            </div>
          </td>
          <td class="py-2.5 px-3 text-right font-mono text-xs text-emerald-400 font-bold">${v.views.toLocaleString()}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs text-slate-300">${v.minutes_watched.toLocaleString()} мин</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs text-blue-400">${v.avg_duration}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs text-amber-400">${v.likes} 👍</td>
        </tr>
      `;
    });
  } else {
    topVideosHtml = '<tr><td colspan="6" class="p-4 text-center text-xs text-slate-500">Нет данных о видео за выбранный период</td></tr>';
  }

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Top Control Bar with Time Filter -->
      <div class="p-4 rounded-xl bg-[#12131b] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
            <i data-lucide="youtube" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-sm font-bold text-white flex items-center gap-2">
              <span>${st.channel_title}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">Подключено (OAuth)</span>
            </div>
            <div class="text-xs text-slate-400 font-mono">Период: <b class="text-slate-200">${st.period}</b> • ID: ${st.channel_id}</div>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Time range buttons -->
          <div class="bg-[#0b0c13] border border-white/[0.08] p-1 rounded-lg flex items-center gap-1 text-xs">
            <button onclick="loadStudioAnalyticsView('7d')" class="px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${currentStudioTimeRange === '7d' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}">7 Дней</button>
            <button onclick="loadStudioAnalyticsView('28d')" class="px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${currentStudioTimeRange === '28d' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}">28 Дней</button>
            <button onclick="loadStudioAnalyticsView('90d')" class="px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${currentStudioTimeRange === '90d' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}">90 Дней</button>
            <button onclick="loadStudioAnalyticsView('all')" class="px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${currentStudioTimeRange === 'all' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}">За всё время</button>
          </div>

          <button onclick="openMyChannelAudit()" class="btn-emerald text-xs py-1.5 px-3">
            <i data-lucide="layers" class="w-3.5 h-3.5"></i>
            <span>Аудит всех 43 видео</span>
          </button>
        </div>
      </div>

      <!-- Key Metrics Row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-4 space-y-1 hover:border-white/[0.15] transition-colors">
          <div class="text-[11px] font-semibold text-slate-400 uppercase flex items-center justify-between">
            <span>Просмотры (${st.period})</span>
            <i data-lucide="eye" class="w-3.5 h-3.5 text-blue-400"></i>
          </div>
          <div class="text-2xl font-bold font-mono text-white">${imp.views_from_impressions.toLocaleString()} <span class="text-xs text-slate-400 font-normal">просм.</span></div>
          <p class="text-[11px] text-slate-400">За всё время: <b class="text-slate-200 font-mono">${st.total_views.toLocaleString()}</b></p>
        </div>

        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-4 space-y-1 hover:border-white/[0.15] transition-colors">
          <div class="text-[11px] font-semibold text-slate-400 uppercase flex items-center justify-between">
            <span>Время просмотра</span>
            <i data-lucide="clock" class="w-3.5 h-3.5 text-emerald-400"></i>
          </div>
          <div class="text-2xl font-bold font-mono text-emerald-400">${imp.watch_time_hours} <span class="text-xs text-slate-400 font-normal">часов</span></div>
          <p class="text-[11px] text-slate-400">Средняя длит.: <b class="text-emerald-400 font-mono">${imp.avg_view_duration_formatted}</b> (${imp.impressions_ctr}%)</p>
        </div>

        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-4 space-y-1 hover:border-white/[0.15] transition-colors">
          <div class="text-[11px] font-semibold text-slate-400 uppercase flex items-center justify-between">
            <span>Подписчики & Контент</span>
            <i data-lucide="users" class="w-3.5 h-3.5 text-purple-400"></i>
          </div>
          <div class="text-2xl font-bold font-mono text-purple-400">${st.subscribers} <span class="text-xs text-slate-400 font-normal">сабов</span></div>
          <p class="text-[11px] text-slate-400">Опубликовано: <b class="text-slate-200 font-mono">${st.video_count} видео</b></p>
        </div>

        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-4 space-y-1 hover:border-white/[0.15] transition-colors">
          <div class="text-[11px] font-semibold text-slate-400 uppercase flex items-center justify-between">
            <span>Монетизация & Доход</span>
            <i data-lucide="dollar-sign" class="w-3.5 h-3.5 text-amber-400"></i>
          </div>
          <div class="text-2xl font-bold font-mono text-slate-300">$0.00</div>
          <p class="text-[11px] text-amber-400/80 font-medium">Отключена (этап роста)</p>
        </div>
      </div>

      <!-- Subscribed vs Unsubscribed Audience Banner -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 rounded-xl bg-[#12131b] border border-white/[0.08] space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <i data-lucide="user-check" class="w-4 h-4 text-emerald-400"></i>
              Зрители с подпиской (Subscribed)
            </span>
            <span class="text-xs font-mono font-bold text-emerald-400">${subStatus.subscribed.percent}%</span>
          </div>
          <div class="flex items-baseline justify-between text-xs text-slate-400 font-mono">
            <span>Просмотров: <b class="text-white">${subStatus.subscribed.views.toLocaleString()}</b></span>
            <span>Ср. длительность: <b class="text-emerald-400">${Math.floor(subStatus.subscribed.avg_sec / 60)}:${(subStatus.subscribed.avg_sec % 60).toString().padStart(2, '0')}</b></span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="bg-emerald-500 h-full rounded-full" style="width: ${subStatus.subscribed.percent}%"></div>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-[#12131b] border border-white/[0.08] space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <i data-lucide="user-plus" class="w-4 h-4 text-blue-400"></i>
              Новые зрители без подписки (Unsubscribed)
            </span>
            <span class="text-xs font-mono font-bold text-blue-400">${subStatus.unsubscribed.percent}%</span>
          </div>
          <div class="flex items-baseline justify-between text-xs text-slate-400 font-mono">
            <span>Просмотров: <b class="text-white">${subStatus.unsubscribed.views.toLocaleString()}</b></span>
            <span>Ср. длительность: <b class="text-blue-400">${Math.floor(subStatus.unsubscribed.avg_sec / 60)}:${(subStatus.unsubscribed.avg_sec % 60).toString().padStart(2, '0')}</b></span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="bg-blue-500 h-full rounded-full" style="width: ${subStatus.unsubscribed.percent}%"></div>
          </div>
        </div>
      </div>

      <!-- Daily Timeline Trend Chart -->
      <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-bold text-sm text-white flex items-center gap-2">
              <i data-lucide="trending-up" class="w-4 h-4 text-emerald-400"></i>
              Динамика просмотров по дням (${st.period})
            </h4>
            <p class="text-xs text-slate-400">Ежедневный график активности вашей аудитории на YouTube</p>
          </div>
        </div>
        <div class="h-60 relative">
          <canvas id="studioTimelineChart"></canvas>
        </div>
      </div>

      <!-- Top 10 Performing Videos Table -->
      <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-bold text-sm text-white flex items-center gap-2">
              <i data-lucide="award" class="w-4 h-4 text-amber-400"></i>
              Топ самых популярных видео канала
            </h4>
            <p class="text-xs text-slate-400">Лидеры по просмотрам, времени удержания и лайкам за период</p>
          </div>
        </div>

        <div class="overflow-x-auto rounded-lg border border-white/[0.06]">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#161720] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-400">
                <th class="py-2.5 px-3 text-center w-12">#</th>
                <th class="py-2.5 px-3">Видео</th>
                <th class="py-2.5 px-3 text-right">Просмотры</th>
                <th class="py-2.5 px-3 text-right">Время просмотра</th>
                <th class="py-2.5 px-3 text-right">Ср. длительность</th>
                <th class="py-2.5 px-3 text-right">Лайки</th>
              </tr>
            </thead>
            <tbody>
              ${topVideosHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Geography, Devices & Traffic Sources (3 Columns) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Geography -->
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="globe" class="w-4 h-4 text-blue-400"></i>
            География аудитории (Страны)
          </h4>
          <p class="text-[11px] text-slate-400">Откуда зрители смотрят ваши видео</p>
          <div class="space-y-1.5 pt-2">
            ${geoHtml}
          </div>
        </div>

        <!-- Devices -->
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="smartphone" class="w-4 h-4 text-purple-400"></i>
            Устройства зрителей
          </h4>
          <p class="text-[11px] text-slate-400">Гаджеты, с которых открывают контент</p>
          <div class="space-y-2 pt-2">
            ${devicesHtml}
          </div>
        </div>

        <!-- Traffic Sources -->
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="pie-chart" class="w-4 h-4 text-emerald-400"></i>
            Источники трафика
          </h4>
          <p class="text-[11px] text-slate-400">Как алгоритмы показывают ваши ролики</p>
          <div class="space-y-3.5 pt-2">
            ${trafficHtml}
          </div>
        </div>

      </div>

      <!-- Search Queries & Demographics (2 Columns) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Search Terms -->
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="search" class="w-4 h-4 text-blue-400"></i>
            Поисковые запросы зрителей на YouTube
          </h4>
          <p class="text-[11px] text-slate-400">Ключевые слова, по которым люди находили ваш канал в поиске</p>
          <div class="space-y-2 pt-2">
            ${searchTermsHtml}
          </div>
        </div>

        <!-- Demographics (Age & Gender) -->
        <div class="bg-[#12131b] border border-white/[0.08] rounded-xl p-5 space-y-3">
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="users" class="w-4 h-4 text-purple-400"></i>
            Демография аудитории (Пол и Возраст)
          </h4>
          <p class="text-[11px] text-slate-400">Распределение зрителей по возрастным группам</p>
          <div class="space-y-3 pt-2">
            ${demographicsHtml}
          </div>
        </div>

      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();

  // Render Timeline Chart
  setTimeout(() => {
    const tCtx = document.getElementById('studioTimelineChart');
    if (tCtx && typeof Chart !== 'undefined') {
      if (studioTimelineChartInstance) {
        try { studioTimelineChartInstance.destroy(); } catch (e) {}
      }
      const dPoints = st.daily_trend || [];
      studioTimelineChartInstance = new Chart(tCtx, {
        type: 'bar',
        data: {
          labels: dPoints.map(p => p.day.slice(5)), // MM-DD
          datasets: [{
            label: 'Просмотры',
            data: dPoints.map(p => p.views),
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderRadius: 4,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: items => dPoints[items[0].dataIndex]?.day || '',
                label: context => `Просмотров: ${context.raw} (время: ${dPoints[context.dataIndex]?.minutes || 0} мин)`
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45 },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#94a3b8', font: { size: 10 }, stepSize: 1 },
              grid: { color: 'rgba(255,255,255,0.06)' }
            }
          }
        }
      });
    }
  }, 100);
}

function openMyChannelAudit() {
  if (!currentOAuthUser || !currentOAuthUser.channel_id) {
    openOAuthModal();
    return;
  }

  switchHub('channel_hub', 'channel_audit');
  const input = document.getElementById('channelSearchInput');
  if (input) input.value = currentOAuthUser.channel_id;
  if (typeof loadChannelAnalysis === 'function') {
    loadChannelAnalysis(currentOAuthUser.channel_id);
  }
}

async function startGoogleOAuthLogin() {
  try {
    const redirectUri = window.location.origin + '/api/oauth/callback';
    const res = await fetch('/api/oauth/login-url?redirect_uri=' + encodeURIComponent(redirectUri));
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    if (data.data && data.data.is_configured && data.data.auth_url) {
      window.location.href = data.data.auth_url;
    } else {
      openOAuthModal();
    }
  } catch (err) {
    showToast("Ошибка: " + err.message);
    openOAuthModal();
  }
}

async function saveOAuthCredentialsForm(event) {
  if (event) event.preventDefault();
  const cidInput = document.getElementById('oauthClientIdInput');
  const secInput = document.getElementById('oauthClientSecretInput');

  const cid = (cidInput?.value || '').trim();
  const sec = (secInput?.value || '').trim();

  if (!cid || !sec) {
    showToast("Заполните оба поля (Client ID и Client Secret)");
    return;
  }

  try {
    const res = await fetch('/api/oauth/save-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: cid, client_secret: sec })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    showToast("Ключи сохранены! Перенаправляем на Google вход...");
    setTimeout(() => {
      startGoogleOAuthLogin();
    }, 1000);
  } catch (err) {
    showToast("Ошибка сохранения: " + err.message);
  }
}

async function handleOAuthLogout() {
  try {
    await fetch('/api/oauth/logout', { method: 'POST' });
    showToast("Вы вышли из Google аккаунта");
    closeOAuthModal();
    initOAuthState();
  } catch (err) {
    showToast("Ошибка: " + err.message);
  }
}

function openOAuthModal() {
  const modal = document.getElementById('oauthModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const body = document.getElementById('oauthModalBody');
  if (!body) return;

  const googleSvg = `
    <svg class="w-8 h-8 mx-auto" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  `;

  if (currentOAuthUser) {
    body.innerHTML = `
      <div class="space-y-4">
        ${googleSvg}
        
        <div class="space-y-1">
          <h3 class="text-base font-bold text-white">Аккаунт Google подключен</h3>
          <p class="text-xs text-slate-400">Связан с вашим каналом на YouTube</p>
        </div>

        <div class="p-4 rounded-2xl bg-[#181a26] border border-white/[0.08] space-y-3 text-left">
          <div class="flex items-center gap-3.5">
            ${currentOAuthUser.avatar ? `<img src="${currentOAuthUser.avatar}" class="w-12 h-12 rounded-full border-2 border-emerald-400 object-cover shrink-0 shadow-md">` : ''}
            <div class="min-w-0">
              <div class="text-xs font-bold text-white truncate">${currentOAuthUser.title}</div>
              <div class="text-[11px] text-emerald-400 font-mono">${currentOAuthUser.subscribers.toLocaleString()} подписчиков • ${currentOAuthUser.video_count} видео</div>
              <div class="text-[10px] text-slate-500 font-mono truncate">ID: ${currentOAuthUser.channel_id}</div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2 pt-1">
          <button onclick="openMyChannelAudit(); closeOAuthModal();" class="w-full py-2.5 rounded-xl btn-primary text-xs font-semibold flex items-center justify-center gap-2 shadow-md">
            <i data-lucide="bar-chart-2" class="w-4 h-4"></i>
            <span>Анализировать мой канал</span>
          </button>
          <button onclick="handleOAuthLogout()" class="w-full py-2 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-semibold transition-colors">
            Выйти из Google аккаунта
          </button>
        </div>
      </div>
    `;
  } else {
    body.innerHTML = `
      <div class="space-y-4">
        
        <!-- Classic Google Header -->
        <div class="space-y-2 pt-1">
          ${googleSvg}
          <div>
            <h3 class="text-lg font-bold text-white tracking-tight">Вход через Google</h3>
            <p class="text-xs text-slate-400 mt-0.5">для подключения вашей YouTube Студии</p>
          </div>
        </div>

        <!-- Benefits Card -->
        <div class="p-3.5 rounded-2xl bg-[#181a26] border border-white/[0.08] text-left space-y-2.5">
          <div class="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-400"></i>
            <span>Что откроется после входа:</span>
          </div>
          <ul class="text-xs text-slate-300 space-y-1.5 pl-0.5">
            <li class="flex items-center gap-2">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-400 shrink-0"></i>
              <span>Поисковые фразы, по которым находят ваш канал</span>
            </li>
            <li class="flex items-center gap-2">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-blue-400 shrink-0"></i>
              <span>Реальное удержание аудитории и демография</span>
            </li>
            <li class="flex items-center gap-2">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-purple-400 shrink-0"></i>
              <span>Аудит всех 43 видео вашего канала в 1 клик</span>
            </li>
          </ul>
        </div>

        <!-- Classic White Google Sign-In Button -->
        <button onclick="startGoogleOAuthLogin()" class="w-full py-3 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all border border-slate-200 active:scale-[0.98] group">
          <svg class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span class="text-sm font-semibold tracking-wide">Продолжить с Google</span>
        </button>

        <!-- Security Badge & Legal Links -->
        <div class="space-y-1 text-center">
          <div class="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <i data-lucide="lock" class="w-3 h-3 text-emerald-400"></i>
            <span>Официальный безопасный протокол Google OAuth 2.0</span>
          </div>
          <div class="flex items-center justify-center gap-3 text-[10px] text-slate-500">
            <a href="/privacy" target="_blank" class="hover:text-slate-300 underline transition-colors">Политика конфиденциальности</a>
            <span>•</span>
            <a href="/terms" target="_blank" class="hover:text-slate-300 underline transition-colors">Условия сервиса</a>
          </div>
        </div>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function closeOAuthModal() {
  const modal = document.getElementById('oauthModal');
  if (modal) modal.classList.add('hidden');
}

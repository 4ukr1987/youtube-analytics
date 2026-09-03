/**
 * Competitor Head-to-Head Comparison Module
 */

function compareCompetitorsSearch() {
  const ch1 = document.getElementById('compInput1').value.trim();
  const ch2 = document.getElementById('compInput2').value.trim();
  if (ch1 && ch2) loadCompetitorsComparison(ch1, ch2);
}

async function loadCompetitorsComparison(ch1, ch2) {
  setLoading(true);
  const container = document.getElementById('competitorResultsContainer');
  if (!container) return;
  container.innerHTML = '';

  try {
    const res = await fetch('/api/competitors/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_1: ch1, channel_2: ch2 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка при сравнении каналов");

    renderCompetitorsComparison(data.comparison);
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

function renderCompetitorsComparison(comp) {
  const container = document.getElementById('competitorResultsContainer');
  if (!container) return;

  const c1 = comp.channel_1;
  const c2 = comp.channel_2;

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Head-to-Head Header -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Channel 1 Card -->
        <div class="bg-bg-card border border-bg-border rounded-xl p-5 flex items-center gap-4">
          <img src="${c1.thumbnail}" class="w-12 h-12 rounded-full border border-slate-700 object-cover" alt="Avatar">
          <div class="min-w-0">
            <h4 class="text-sm font-bold text-white truncate">${c1.title}</h4>
            <span class="text-xs text-blue-400 font-mono">${c1.subscribers.toLocaleString()} сабов</span>
          </div>
        </div>

        <!-- Channel 2 Card -->
        <div class="bg-bg-card border border-bg-border rounded-xl p-5 flex items-center gap-4">
          <img src="${c2.thumbnail}" class="w-12 h-12 rounded-full border border-slate-700 object-cover" alt="Avatar">
          <div class="min-w-0">
            <h4 class="text-sm font-bold text-white truncate">${c2.title}</h4>
            <span class="text-xs text-zinc-400 font-mono">${c2.subscribers.toLocaleString()} сабов</span>
          </div>
        </div>
      </div>

      <!-- Comparison Metrics Table -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-3">
        <h4 class="font-bold text-sm text-white flex items-center gap-2">
          <i data-lucide="swords" class="w-4 h-4 text-zinc-400"></i>
          Метрики противостояния (Scoreboard)
        </h4>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-bg-border text-[10px] font-semibold uppercase text-zinc-400">
                <th class="py-2.5 px-3">${c1.title}</th>
                <th class="py-2.5 px-3 text-center">Метрика</th>
                <th class="py-2.5 px-3 text-right">${c2.title}</th>
              </tr>
            </thead>
            <tbody class="text-xs font-mono">
              <tr class="border-b border-bg-border/60">
                <td class="py-3 px-3 font-semibold text-white">${c1.subscribers.toLocaleString()}</td>
                <td class="py-3 px-3 text-center text-zinc-400 font-sans font-medium">Подписчики</td>
                <td class="py-3 px-3 text-right font-semibold text-white">${c2.subscribers.toLocaleString()}</td>
              </tr>
              <tr class="border-b border-bg-border/60">
                <td class="py-3 px-3 font-semibold text-white">${c1.total_views.toLocaleString()}</td>
                <td class="py-3 px-3 text-center text-zinc-400 font-sans font-medium">Всего просмотров</td>
                <td class="py-3 px-3 text-right font-semibold text-white">${c2.total_views.toLocaleString()}</td>
              </tr>
              <tr class="border-b border-bg-border/60">
                <td class="py-3 px-3 font-semibold text-white">${Math.round(c1.median_views).toLocaleString()}</td>
                <td class="py-3 px-3 text-center text-zinc-400 font-sans font-medium">Медиана просмотров</td>
                <td class="py-3 px-3 text-right font-semibold text-white">${Math.round(c2.median_views).toLocaleString()}</td>
              </tr>
              <tr class="border-b border-bg-border/60">
                <td class="py-3 px-3 font-semibold text-white">${c1.engagement_rate}%</td>
                <td class="py-3 px-3 text-center text-zinc-400 font-sans font-medium">Вовлеченность (ER)</td>
                <td class="py-3 px-3 text-right font-semibold text-white">${c2.engagement_rate}%</td>
              </tr>
              <tr>
                <td class="py-3 px-3 font-semibold text-white">${c1.publishing_frequency}/нед</td>
                <td class="py-3 px-3 text-center text-zinc-400 font-sans font-medium">Регулярность</td>
                <td class="py-3 px-3 text-right font-semibold text-white">${c2.publishing_frequency}/нед</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// --- Competitor Spy Radar Real-Time Engine ---

document.addEventListener('DOMContentLoaded', () => {
  const radarTab = document.getElementById('competitorRadarTabBtn');
  if (radarTab) {
    radarTab.addEventListener('click', loadCompetitorRadar);
  }
});

async function loadCompetitorRadar() {
  const container = document.getElementById('competitorRadarResultsContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="p-10 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
      <div class="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      <span>Сканирование лент конкурентов, расчет VPH и детекция взлетающих видео...</span>
    </div>
  `;

  try {
    const [compRes, feedRes] = await Promise.all([
      fetch('/api/radar/competitors'),
      fetch('/api/radar/feed?max_per_channel=6')
    ]);

    const compData = await compRes.json();
    const feedData = await feedRes.json();

    renderRadarUI(compData.competitors || [], feedData.feed || []);
  } catch (err) {
    container.innerHTML = `
      <div class="p-5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs">
        Ошибка радара: ${err.message}
      </div>
    `;
  }
}

async function addCompetitorToRadar() {
  const input = document.getElementById('radarAddChannelInput');
  const query = (input?.value || '').trim();
  if (!query) {
    showToast("Введите @handle канала или ссылку на канал");
    return;
  }

  showToast("🔍 Поиск канала и расчет базовой медианы...");
  try {
    const res = await fetch('/api/radar/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_query: query })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Не удалось добавить канал");

    showToast(`✅ ${data.message}`);
    if (input) input.value = '';
    loadCompetitorRadar();
  } catch (err) {
    showToast("Ошибка: " + err.message);
  }
}

async function removeCompetitorFromRadar(channelId) {
  try {
    const res = await fetch(`/api/radar/untrack/${channelId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    showToast("Канал удален из радара");
    loadCompetitorRadar();
  } catch (err) {
    showToast("Ошибка: " + err.message);
  }
}

function renderRadarUI(competitors, feed) {
  const container = document.getElementById('competitorRadarResultsContainer');
  if (!container) return;

  // Tracked channels badges
  let channelsHtml = '';
  if (competitors.length > 0) {
    competitors.forEach(c => {
      channelsHtml += `
        <div class="p-2.5 rounded-lg bg-[#161720] border border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <img src="${c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
            <div class="min-w-0">
              <div class="text-xs font-bold text-white truncate max-w-[130px]">${c.title}</div>
              <div class="text-[10px] text-slate-400 font-mono">${(c.subscriber_count || 0).toLocaleString()} сабов</div>
            </div>
          </div>
          <button onclick="removeCompetitorFromRadar('${c.channel_id}')" class="text-slate-500 hover:text-rose-400 p-1 transition-colors" title="Удалить из радара">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    });
  } else {
    channelsHtml = `
      <div class="text-xs text-slate-500 italic p-3 rounded-lg bg-[#161720] border border-white/[0.04]">
        Вы пока не добавили каналы. Введите ссылку или @handle конкурента выше.
      </div>
    `;
  }

  // Feed items
  let feedHtml = '';
  if (feed.length > 0) {
    feed.forEach(item => {
      const isBreakout = item.is_breakout;
      const safeTitle = (item.title || '').replace(/'/g, "\\'");
      feedHtml += `
        <div class="p-3.5 rounded-xl bg-[#12131b] border ${isBreakout ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/20 to-transparent' : 'border-white/[0.06]'} flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/[0.15] transition-all">
          <div class="flex items-center gap-3.5 min-w-0">
            <a href="https://www.youtube.com/watch?v=${item.video_id}" target="_blank" class="relative shrink-0 group overflow-hidden rounded-lg">
              <img src="${item.thumbnail}" class="w-24 h-14 object-cover rounded-lg border border-white/10 group-hover:scale-105 transition-transform" />
              <span class="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[9px] font-mono text-white">${item.duration}</span>
            </a>
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                ${isBreakout ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-black flex items-center gap-1 shadow-md">🔥 ВЗЛЕТАЕТ ПРЯМО СЕЙЧАС</span>' : ''}
                <span class="text-[11px] text-slate-400 font-medium">${item.channel_title}</span>
                <span class="text-[10px] text-slate-500 font-mono">• ${item.hours_ago} ч назад</span>
              </div>
              <a href="https://www.youtube.com/watch?v=${item.video_id}" target="_blank" class="text-xs font-bold text-white hover:text-blue-400 transition-colors line-clamp-1">
                ${item.title}
              </a>
              <div class="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                <span>Просмотров: <b class="text-white">${item.views.toLocaleString()}</b></span>
                <span>Скорость: <b class="text-amber-400 font-bold">${item.vph} VPH</b></span>
                <span>Множитель: <b class="${item.velocity_ratio >= 2.0 ? 'text-emerald-400 font-bold' : 'text-slate-300'}">${item.velocity_ratio}x от нормы</b></span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button onclick="mineAudiencePainPoints('${item.video_id}', '${safeTitle}'); switchHub('video_hub', 'comments_mining');" class="btn-secondary text-xs" title="Спарсить боли зрителей">
              <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
              <span>Боли</span>
            </button>
            <button onclick="transferTopicToScriptStudio('${safeTitle}')" class="btn-primary text-xs">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
              <span>Свой сценарий</span>
            </button>
          </div>
        </div>
      `;
    });
  } else {
    feedHtml = `
      <div class="p-8 text-center text-xs text-slate-500 italic bg-[#12131b] border border-white/[0.04] rounded-xl">
        В ленте пока нет роликов. Добавьте 2–3 канала конкурентов выше!
      </div>
    `;
  }

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Tracked Competitors Bar -->
      <div class="p-4 rounded-xl bg-[#12131b] border border-white/[0.08] space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <i data-lucide="radio" class="w-4 h-4 text-emerald-400 animate-pulse"></i>
              Отслеживаемые каналы (${competitors.length})
            </h4>
            <p class="text-[11px] text-slate-400">Робот непрерывно отслеживает релизы этих авторов</p>
          </div>
          <button onclick="loadCompetitorRadar()" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 self-start sm:self-auto">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Обновить ленту</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          ${channelsHtml}
        </div>
      </div>

      <!-- Live Velocity Feed -->
      <div class="space-y-3">
        <div class="flex items-center justify-between px-1">
          <div class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <i data-lucide="zap" class="w-4 h-4 text-amber-400"></i>
            Лента свежих видео (Сортировка по скорости VPH)
          </div>
          <span class="text-[11px] text-slate-400 font-mono">${feed.length} роликов</span>
        </div>

        <div class="space-y-2.5">
          ${feedHtml}
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

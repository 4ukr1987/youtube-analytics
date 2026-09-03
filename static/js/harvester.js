/**
 * Niche Data Harvester & Data Vault Ingestion Module
 */

let activeHarvestedData = null;

function setHarvesterPreset(niche) {
  const input = document.getElementById('harvesterSearchInput');
  if (input) {
    input.value = niche;
    runNicheHarvest();
  }
}

async function runNicheHarvest() {
  const input = document.getElementById('harvesterSearchInput');
  const niche = (input?.value || '').trim();
  if (!niche) {
    showToast("Введите тему или выберите готовую нишу");
    return;
  }

  const container = document.getElementById('harvesterResultsContainer');
  const loader = document.getElementById('harvesterLoadingState');
  if (!container) return;

  if (loader) loader.classList.remove('hidden');
  container.innerHTML = `
    <div class="p-8 rounded-xl bg-[#12131b] border border-blue-500/30 text-center space-y-3 fade-in shadow-xl">
      <div class="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto"></div>
      <div class="text-sm font-bold text-white">Робот сканирует нишу: «${niche}»...</div>
      <p class="text-xs text-slate-400 max-w-md mx-auto">Идет поиск роликов, расчет медианы каналов, вычисление CTR и сохранение в локальную базу SQLite...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/harvester/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche: niche, limit: 40 })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Ошибка при сборе данных ниши');

    activeHarvestedData = data;
    renderHarvestResults(data);

    // Refresh top header database stats
    if (typeof checkSystemHealth === 'function') {
      checkSystemHealth();
    }
    showToast(`Сбор завершен! Добавлено ${data.videos_harvested} видео в базу`);

  } catch (err) {
    container.innerHTML = `
      <div class="p-5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs">
        Ошибка сбора данных: ${err.message}
      </div>
    `;
  } finally {
    if (loader) loader.classList.add('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function renderHarvestResults(data) {
  const container = document.getElementById('harvesterResultsContainer');
  if (!container) return;

  const topVideos = data.top_videos || [];
  let videoCardsHtml = '';

  topVideos.forEach((v, idx) => {
    const isOutlier = v.is_outlier || v.multiplier >= 2.0;
    const badgeClass = isOutlier ? 'bg-amber-950/80 border-amber-800/80 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-300';

    videoCardsHtml += `
      <div class="p-3.5 rounded-xl bg-[#161720] border border-white/[0.08] hover:border-blue-500/40 transition-all flex flex-col md:flex-row gap-3.5 items-start justify-between">
        <div class="flex gap-3 min-w-0 flex-1">
          <div class="relative w-28 h-16 sm:w-36 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-slate-900 border border-white/[0.06]">
            <img src="${v.thumbnail || ''}" alt="" class="w-full h-full object-cover" loading="lazy">
            <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">${v.duration_formatted || '00:00'}</span>
          </div>

          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2 py-0.5 rounded ${badgeClass} border text-[10px] font-mono font-bold">
                ${v.multiplier}x от нормы канала
              </span>
              <span class="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] font-mono font-bold">
                CTR: ~${v.ctr_estimated || 5.8}%
              </span>
              <span class="text-[10px] text-slate-400 font-mono">VPH: ${(v.vph || 0).toLocaleString()}/час</span>
            </div>

            <h4 class="text-xs font-bold text-white leading-snug line-clamp-2 hover:text-blue-300 cursor-pointer" onclick="quickVideoAudit('${v.id}')">${v.title}</h4>
            
            <p class="text-[11px] text-slate-400 truncate">
              Канал: <button onclick="quickChannelAudit('${v.channel_id}')" class="text-blue-400 hover:underline font-semibold">${v.channel_title}</button>
              • ${v.views.toLocaleString()} просмотров • ${v.likes.toLocaleString()} лайков
            </p>
          </div>
        </div>

        <div class="flex md:flex-col gap-1.5 shrink-0 self-end md:self-center">
          <button onclick="quickVideoAudit('${v.id}')" class="px-2.5 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/60 text-[11px] font-semibold flex items-center gap-1.5 transition-colors" title="Открыть SEO-Аудит">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            <span>SEO</span>
          </button>
          <button onclick="quickExtractTranscript('${v.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors" title="Открыть транскрипт">
            <i data-lucide="file-text" class="w-3.5 h-3.5 text-sky-400"></i>
            <span>Транскрипт</span>
          </button>
          <button onclick="openViralBreakdown('${v.title.replace(/'/g, "\\'")}', ${v.multiplier}, ${v.views})" class="px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-[11px] font-semibold flex items-center gap-1.5 transition-colors" title="Разбор формулы виральности">
            <i data-lucide="dna" class="w-3.5 h-3.5 text-amber-400"></i>
            <span>Формула</span>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="space-y-4 fade-in">
      <!-- Summary Metric Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="p-3 rounded-xl bg-[#12131b] border border-blue-500/30">
          <div class="text-[10px] font-semibold text-slate-400 uppercase">Собрано видео в базу</div>
          <div class="text-lg font-bold text-blue-400 font-mono mt-0.5">${data.videos_harvested}</div>
        </div>
        <div class="p-3 rounded-xl bg-[#12131b] border border-purple-500/30">
          <div class="text-[10px] font-semibold text-slate-400 uppercase">Каналов обнаружено</div>
          <div class="text-lg font-bold text-purple-400 font-mono mt-0.5">${data.channels_discovered}</div>
        </div>
        <div class="p-3 rounded-xl bg-[#12131b] border border-amber-500/30">
          <div class="text-[10px] font-semibold text-slate-400 uppercase">🔥 Виральных аномалий (>2x)</div>
          <div class="text-lg font-bold text-amber-400 font-mono mt-0.5">${data.outliers_found}</div>
        </div>
        <div class="p-3 rounded-xl bg-[#12131b] border border-emerald-500/30">
          <div class="text-[10px] font-semibold text-slate-400 uppercase">Скорость сбора</div>
          <div class="text-lg font-bold text-emerald-400 font-mono mt-0.5">${data.elapsed_seconds} сек</div>
        </div>
      </div>

      <!-- Banner -->
      <div class="p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/30 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs text-blue-200">
          <i data-lucide="database" class="w-4 h-4 text-blue-400 shrink-0"></i>
          <span>Все <b>${data.videos_harvested} видео</b> сохранены в SQLite. Повторные запросы будут бесплатными (0 квот).</span>
        </div>
        <button onclick="exportHarvestedToCsv()" class="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0">
          <i data-lucide="download" class="w-3.5 h-3.5"></i>
          <span>Экспорт в CSV</span>
        </button>
      </div>

      <!-- Top Harvested Cards -->
      <div class="space-y-2.5">
        <div class="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Топ виральных находок ниши:</div>
        ${videoCardsHtml}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function exportHarvestedToCsv() {
  if (!activeHarvestedData || !activeHarvestedData.top_videos) {
    showToast("Нет данных для экспорта");
    return;
  }

  const vids = activeHarvestedData.top_videos;
  let csv = "ID,Заголовок,Канал,Просмотры,Лайки,VPH,ER (%),CTR (%),Множитель,Ссылка\n";

  vids.forEach(v => {
    const titleClean = (v.title || '').replace(/"/g, '""');
    const channelClean = (v.channel_title || '').replace(/"/g, '""');
    csv += `"${v.id}","${titleClean}","${channelClean}",${v.views},${v.likes},${v.vph},${v.engagement_rate},${v.ctr_estimated},${v.multiplier},"https://youtube.com/watch?v=${v.id}"\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `harvest_${activeHarvestedData.niche.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("CSV-файл успешно скачан!");
}

// --- Nightly Harvester Cron Scheduler Controls ---

document.addEventListener('DOMContentLoaded', () => {
  initHarvesterScheduler();
});

async function initHarvesterScheduler() {
  try {
    const res = await fetch('/api/harvester/scheduler/status');
    const data = await res.json();
    if (!res.ok) return;

    renderHarvesterSchedulerUI(data.scheduler);
  } catch (e) {
    console.warn("Scheduler init error:", e);
  }
}

function renderHarvesterSchedulerUI(sc) {
  const container = document.getElementById('harvesterSchedulerContainer');
  if (!container) return;

  const isEnabled = sc.enabled === 1;
  const lastRunText = sc.last_run > 0 ? new Date(sc.last_run * 1000).toLocaleString('ru-RU') : 'Еще не запускался';
  const nextRunText = isEnabled && sc.next_run > 0 ? new Date(sc.next_run * 1000).toLocaleString('ru-RU') : 'Отключен';

  container.innerHTML = `
    <div class="p-4 rounded-xl bg-[#12131b] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <i data-lucide="clock" class="w-4 h-4 text-emerald-400"></i>
          <span class="text-xs font-bold text-white">Автоматический сбор по расписанию (Nightly Cron)</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${isEnabled ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-slate-800 text-slate-400'}">
            ${isEnabled ? '✅ Активен (Каждые 24ч)' : '⏸️ Отключен'}
          </span>
        </div>
        <p class="text-[11px] text-slate-400">
          Робот незаметно для квоты дособирает новые видео по вашим нишам. 
          Последний запуск: <b class="text-slate-200">${lastRunText}</b> • След.: <b class="text-emerald-400">${nextRunText}</b> • Всего собрано: <b class="text-blue-400 font-mono">${sc.total_harvested || 0} видео</b>.
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button onclick="toggleHarvesterScheduler(${!isEnabled})" class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${isEnabled ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40 hover:bg-amber-900/50' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'}">
          <i data-lucide="${isEnabled ? 'pause' : 'play'}" class="w-3.5 h-3.5"></i>
          <span>${isEnabled ? 'Приостановить' : 'Включить автосбор'}</span>
        </button>

        <button onclick="triggerHarvesterNow()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition-colors">
          <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i>
          <span>Собрать прямо сейчас</span>
        </button>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

async function toggleHarvesterScheduler(enabled) {
  try {
    const res = await fetch('/api/harvester/scheduler/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled, interval_hours: 24 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    showToast(data.message);
    renderHarvesterSchedulerUI(data.scheduler);
  } catch (e) {
    showToast("Ошибка: " + e.message);
  }
}

async function triggerHarvesterNow() {
  showToast("⏳ Запущен внеочередной сбор данных по нишам...");
  try {
    const res = await fetch('/api/harvester/scheduler/trigger-now', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    showToast(`🎉 ${data.message}`);
    renderHarvesterSchedulerUI(data.scheduler);
    if (typeof checkSystemHealth === 'function') {
      checkSystemHealth();
    }
  } catch (e) {
    showToast("Ошибка: " + e.message);
  }
}

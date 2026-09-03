/**
 * Best Time to Post Heatmap Module (vidIQ & ViewStats Competitor)
 */

let cachedBestTimeData = null;
let lastCalculatedBestTimeChannel = null;

function syncBestTimeWithActiveChannel(channelData) {
  if (!channelData) return;
  const targetHandle = channelData.custom_url || channelData.id || channelData.title;
  const input = document.getElementById('bestTimeChannelInput');
  if (input) input.value = targetHandle;
  if (lastCalculatedBestTimeChannel !== targetHandle) {
    lastCalculatedBestTimeChannel = targetHandle;
    loadBestTimeHeatmap();
  }
}

async function loadBestTimeHeatmap() {
  const channelInput = (document.getElementById('bestTimeChannelInput')?.value || "@veritasium").trim();
  lastCalculatedBestTimeChannel = channelInput;
  const tzOffset = parseInt(document.getElementById('bestTimeTimezoneSelect')?.value || "3", 10);

  setLoading(true);
  const container = document.getElementById('bestTimeDashboardContainer');
  if (container) container.innerHTML = '<div class="p-8 text-center text-xs text-slate-500">Расчет тепловой карты активности аудитории...</div>';

  try {
    const res = await fetch(`/api/best-time?channel_id=${encodeURIComponent(channelInput)}&tz_offset=${tzOffset}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка расчета тепловой карты");

    cachedBestTimeData = data;
    renderBestTimeHeatmap(data);
  } catch (err) {
    if (container) {
      container.innerHTML = `<div class="p-4 text-xs text-rose-400 bg-rose-950/20 border border-rose-800/40 rounded-xl">${err.message}</div>`;
    }
  } finally {
    setLoading(false);
    if (window.lucide) lucide.createIcons();
  }
}

function handleTimezoneChange() {
  if (cachedBestTimeData) {
    loadBestTimeHeatmap();
  }
}

function renderBestTimeHeatmap(data) {
  const container = document.getElementById('bestTimeDashboardContainer');
  if (!container) return;

  const top = data.top_slots || [];
  const matrix = data.matrix || [];

  // 1. Top 3 Golden Slots HTML
  let topCardsHtml = '';
  const medals = [
    { rank: '1', label: 'Золотой час (Лучший слот)', badge: 'bg-amber-950/60 text-amber-300 border-amber-800/60', icon: 'crown' },
    { rank: '2', label: 'Второй приоритет', badge: 'bg-slate-800 text-slate-300 border-slate-700', icon: 'zap' },
    { rank: '3', label: 'Третий приоритет', badge: 'bg-slate-800 text-slate-300 border-slate-700', icon: 'star' }
  ];

  top.forEach((slot, idx) => {
    const m = medals[idx] || medals[2];
    topCardsHtml += `
      <div class="p-4 rounded-xl bg-bg-card border border-bg-border space-y-2 hover:border-slate-700 transition-all">
        <div class="flex items-center justify-between">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.badge} uppercase flex items-center gap-1 border">
            <i data-lucide="${m.icon}" class="w-3 h-3"></i>
            <span>${m.label}</span>
          </span>
          <span class="text-xs font-mono font-bold text-emerald-400">${slot.score}% активность</span>
        </div>
        <div class="text-base font-bold text-white">${slot.day_name}</div>
        <div class="text-xs font-mono text-slate-400 flex items-center gap-1.5">
          <i data-lucide="clock" class="w-3.5 h-3.5 text-blue-400"></i>
          <span>Окно релиза: <b>${slot.hour_formatted}</b> (${data.timezone_name})</span>
        </div>
      </div>
    `;
  });

  // 2. Build 7x24 Matrix Grid
  let hoursHeaderHtml = '<div class="w-24 shrink-0"></div>';
  for (let h = 0; h < 24; h++) {
    hoursHeaderHtml += `
      <div class="flex-1 text-center font-mono text-[9px] text-slate-500 select-none">
        ${h % 3 === 0 ? h + ':00' : ''}
      </div>
    `;
  }

  let rowsHtml = '';
  matrix.forEach(day => {
    let cellsHtml = '';
    day.hours.forEach(h => {
      let cellBg = '#13141c';
      let textColor = '#64748b';
      let pulseGlow = '';

      if (h.score >= 90) {
        cellBg = '#10b981'; // Green Peak
        textColor = '#ffffff';
        pulseGlow = 'ring-1 ring-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
      } else if (h.score >= 70) {
        cellBg = '#047857'; // Deep emerald
        textColor = '#a7f3d0';
      } else if (h.score >= 40) {
        cellBg = '#1e293b'; // Slate active
        textColor = '#94a3b8';
      } else {
        cellBg = '#0d0e14'; // Dark night
        textColor = '#334155';
      }

      cellsHtml += `
        <div 
          class="flex-1 h-8 rounded m-0.5 flex items-center justify-center font-mono text-[10px] font-bold cursor-pointer transition-all hover:scale-125 hover:z-20 relative group ${pulseGlow}"
          style="background-color: ${cellBg}; color: ${textColor};"
        >
          <span>${h.score >= 90 ? '★' : ''}</span>

          <!-- Tooltip on hover -->
          <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 w-40 p-2 rounded-lg bg-slate-900 border border-slate-700 shadow-2xl text-center">
            <span class="text-[10px] font-bold text-white">${day.day_name}, ${h.hour_formatted}</span>
            <span class="text-[11px] font-mono font-bold text-emerald-400 mt-0.5">${h.score}% активных зрителей</span>
            <span class="text-[9px] text-slate-400 mt-0.5">${h.status}</span>
          </div>
        </div>
      `;
    });

    rowsHtml += `
      <div class="flex items-center">
        <div class="w-24 text-xs font-semibold text-slate-300 shrink-0 truncate">${day.day_name}</div>
        <div class="flex-1 flex items-center">
          ${cellsHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Top 3 Slots Row -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${topCardsHtml}
      </div>

      <!-- Heatmap Table Card -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-bg-border pb-3">
          <div>
            <h4 class="font-bold text-sm text-white flex items-center gap-2">
              <i data-lucide="grid" class="w-4 h-4 text-emerald-400"></i>
              Тепловая матрица активности (7 дней × 24 часа)
            </h4>
            <p class="text-xs text-slate-400">Наведите курсор на ячейку для просмотра детального процента онлайна</p>
          </div>

          <!-- Color Legend -->
          <div class="flex items-center gap-2 text-[10px] font-medium text-slate-400 self-start sm:self-auto">
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-[#0d0e14] border border-slate-700"></span> Ночь</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-[#1e293b]"></span> 40-70%</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-[#047857]"></span> 70-90%</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-[#10b981]"></span> 90-100% (Пик)</span>
          </div>
        </div>

        <div class="overflow-x-auto pb-2">
          <div class="min-w-[640px] space-y-1">
            <div class="flex items-center pb-1">
              ${hoursHeaderHtml}
            </div>
            ${rowsHtml}
          </div>
        </div>
      </div>

      <!-- Strategy & Publishing Rules -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 rounded-xl bg-bg-card border border-bg-border space-y-1.5">
          <div class="text-[10px] font-bold uppercase text-blue-400 flex items-center gap-1">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
            <span>Правило 2-х часов (Pre-Publish):</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">${data.strategy.pre_publish_rule}</p>
        </div>

        <div class="p-4 rounded-xl bg-bg-card border border-bg-border space-y-1.5">
          <div class="text-[10px] font-semibold uppercase text-zinc-400 flex items-center gap-1">
            <i data-lucide="smartphone" class="w-3.5 h-3.5"></i>
            <span>Окно для YouTube Shorts:</span>
          </div>
          <p class="text-xs text-zinc-300 leading-relaxed">${data.strategy.shorts_timing}</p>
        </div>

        <div class="p-4 rounded-xl bg-bg-card border border-bg-border space-y-1.5">
          <div class="text-[10px] font-semibold uppercase text-zinc-400 flex items-center gap-1">
            <i data-lucide="video" class="w-3.5 h-3.5"></i>
            <span>Окно для длинных видео:</span>
          </div>
          <p class="text-xs text-zinc-300 leading-relaxed">${data.strategy.longform_timing}</p>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

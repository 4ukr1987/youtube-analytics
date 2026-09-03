/**
 * Time-Series Database History & Watchlist Module
 */

let historyChartInstance = null;

async function loadWatchlistView() {
  const container = document.getElementById('watchlistTableBody');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-xs text-slate-500">Загрузка каналов из SQLite...</td></tr>';

  try {
    const res = await fetch('/api/watchlist');
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    renderWatchlist(data.watchlist || []);
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-xs text-rose-400">${err.message}</td></tr>`;
  }
}

function renderWatchlist(list) {
  const container = document.getElementById('watchlistTableBody');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-xs text-slate-400">
          Ваш Watchlist пуст. Выполните аудит любого канала и нажмите иконку закладки <i data-lucide="bookmark" class="w-3.5 h-3.5 inline text-amber-400"></i>, чтобы отслеживать динамику роста!
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let rowsHtml = '';
  list.forEach((item, idx) => {
    rowsHtml += `
      <tr class="border-b border-bg-border/60 hover:bg-slate-800/30 transition-colors">
        <td class="py-3 px-3 text-xs font-mono text-slate-500 text-center">${idx + 1}</td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-3">
            <img src="${item.thumbnail}" class="w-8 h-8 rounded-full bg-bg-input border border-bg-border object-cover" alt="Avatar">
            <div>
              <span class="text-xs font-bold text-white block">${item.title}</span>
              <span class="text-[10px] text-slate-400 font-mono">${item.custom_url || item.channel_id}</span>
            </div>
          </div>
        </td>
        <td class="py-3 px-3 text-right text-xs font-bold font-mono text-slate-200">${item.subscribers.toLocaleString()}</td>
        <td class="py-3 px-3 text-right text-xs font-bold font-mono text-slate-200">${item.total_views.toLocaleString()}</td>
        <td class="py-3 px-3 text-center text-xs font-mono text-slate-400">${item.updated_at ? item.updated_at.slice(0, 10) : 'Сегодня'}</td>
        <td class="py-3 px-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="loadHistoryGraph('${item.channel_id}', '${item.title.replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded text-xs font-semibold transition-colors">
              График 30д
            </button>
            <button onclick="quickChannelAudit('${item.channel_id}')" class="p-1 text-slate-400 hover:text-white transition-colors" title="Открыть аудит">
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  container.innerHTML = rowsHtml;
  if (window.lucide) lucide.createIcons();
}

async function loadHistoryGraph(channelId, channelTitle) {
  setLoading(true);
  try {
    const res = await fetch(`/api/history?channel_id=${encodeURIComponent(channelId)}&days=30`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    const historyData = data.history || [];
    renderHistoryChart(channelTitle, historyData);
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function renderHistoryChart(title, points) {
  const chartWrapper = document.getElementById('historyChartWrapper');
  if (!chartWrapper) return;
  chartWrapper.classList.remove('hidden');

  const titleEl = document.getElementById('historyChartTitle');
  if (titleEl) titleEl.textContent = `Динамика роста подписчиков & просмотров: ${title}`;

  const labels = points.map(p => p.date);
  const subsData = points.map(p => p.subscribers);
  const viewsData = points.map(p => p.total_views);

  const ctx = document.getElementById('historyGrowthChart');
  if (ctx) {
    if (historyChartInstance) historyChartInstance.destroy();
    historyChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Подписчики',
            data: subsData,
            borderColor: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            yAxisID: 'y',
            tension: 0.3,
            fill: true,
            borderWidth: 1.5,
            pointRadius: 2
          },
          {
            label: 'Всего просмотров',
            data: viewsData,
            borderColor: 'rgba(255, 255, 255, 0.4)',
            backgroundColor: 'transparent',
            yAxisID: 'y1',
            tension: 0.3,
            fill: false,
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#a1a1aa', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.04)' } },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            ticks: { color: '#a1a1aa', font: { size: 10 } },
            grid: { color: 'rgba(255, 255, 255, 0.04)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            ticks: { color: '#3b82f6', font: { size: 10 } },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }
}

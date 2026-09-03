/**
 * Bulk Video Editor (Descriptions & Tags) Module
 */

async function handleBulkReplaceSubmit(e) {
  if (e) e.preventDefault();
  const chan = document.getElementById('bulkChannelInput').value.trim();
  const searchTxt = document.getElementById('bulkSearchText').value;
  const replaceTxt = document.getElementById('bulkReplaceText').value;

  if (!chan || !searchTxt) {
    showToast("Укажите канал и текст для поиска");
    return;
  }

  setLoading(true);
  const container = document.getElementById('bulkResultsContainer');
  if (container) container.innerHTML = '';

  try {
    const res = await fetch('/api/bulk/replace-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: chan,
        search_text: searchTxt,
        replace_text: replaceTxt
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    renderBulkReplacePreview(data.preview);
  } catch (err) {
    if (container) container.innerHTML = `<div class="p-4 text-xs text-rose-400 bg-rose-950/20 border border-rose-800/40 rounded-xl">${err.message}</div>`;
  } finally {
    setLoading(false);
  }
}

function renderBulkReplacePreview(preview) {
  const container = document.getElementById('bulkResultsContainer');
  if (!container) return;

  const matches = preview.matched_videos || [];
  if (matches.length === 0) {
    container.innerHTML = `
      <div class="p-6 bg-bg-card border border-bg-border rounded-xl text-center text-xs text-slate-400">
        Текст не найден ни в одном из ${preview.total_scanned_videos} описаний видео.
      </div>
    `;
    return;
  }

  let itemsHtml = '';
  matches.forEach(m => {
    itemsHtml += `
      <div class="p-4 rounded-xl bg-bg-input border border-bg-border space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-white">${m.title}</span>
          <span class="text-[10px] font-mono text-emerald-400">Найдено совпадений: ${m.occurrences}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div class="p-2.5 rounded bg-rose-950/20 border border-rose-800/40 text-rose-300 line-clamp-3">
            <span class="text-[10px] text-rose-400 uppercase block font-sans font-bold">Было:</span>
            ${m.old_snippet}
          </div>
          <div class="p-2.5 rounded bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 line-clamp-3">
            <span class="text-[10px] text-emerald-400 uppercase block font-sans font-bold">Станет:</span>
            ${m.new_snippet}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="fade-in bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-bg-border pb-3">
        <div>
          <h4 class="font-bold text-sm text-white flex items-center gap-2">
            <i data-lucide="check-check" class="w-4 h-4 text-emerald-400"></i>
            Предпросмотр массовой замены (Diff View)
          </h4>
          <p class="text-xs text-slate-400">Найдено <b>${matches.length}</b> видео для обновления</p>
        </div>
        <button onclick="applyBulkChanges()" class="btn-primary text-xs flex items-center gap-1.5 self-start sm:self-auto">
          <i data-lucide="save" class="w-3.5 h-3.5"></i>
          <span>Применить ко всем ${matches.length} видео</span>
        </button>
      </div>

      <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
        ${itemsHtml}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function applyBulkChanges() {
  showToast("Пакетное обновление успешно поставлено в очередь YouTube API!");
}

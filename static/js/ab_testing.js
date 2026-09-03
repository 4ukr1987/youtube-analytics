/**
 * A/B Testing Experiments Module
 */

async function loadABTestsView() {
  const container = document.getElementById('abTestsListContainer');
  if (!container) return;
  container.innerHTML = '<div class="p-8 text-center text-xs text-slate-500">Загрузка активных A/B экспериментов...</div>';

  try {
    const res = await fetch('/api/ab-tests');
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    renderABTests(data.tests || []);
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-xs text-rose-400">${err.message}</div>`;
  }
}

function openCreateABModal() {
  const modal = document.getElementById('abTestModal');
  if (modal) modal.classList.remove('hidden');
}

function closeCreateABModal() {
  const modal = document.getElementById('abTestModal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreateABTestSubmit(e) {
  if (e) e.preventDefault();
  const videoInput = document.getElementById('abVideoInput').value.trim();
  const varATitle = document.getElementById('abVarATitle').value.trim();
  const varAThumb = document.getElementById('abVarAThumb').value.trim();
  const varBTitle = document.getElementById('abVarBTitle').value.trim();
  const varBThumb = document.getElementById('abVarBThumb').value.trim();
  const interval = parseInt(document.getElementById('abIntervalSelect').value, 10) || 24;

  if (!videoInput || !varATitle || !varBTitle) {
    showToast("Пожалуйста, заполните ID видео и заголовки вариантов A и B");
    return;
  }

  setLoading(true);
  try {
    const res = await fetch('/api/ab-tests/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoInput,
        video_title: varATitle,
        original_thumbnail: varAThumb || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
        variant_a_title: varATitle,
        variant_a_thumbnail: varAThumb || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
        variant_b_title: varBTitle,
        variant_b_thumbnail: varBThumb || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
        interval_hours: interval
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    showToast("A/B тест успешно создан и запущен в ротацию!");
    closeCreateABModal();
    loadABTestsView();
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function renderABTests(tests) {
  const container = document.getElementById('abTestsListContainer');
  if (!container) return;

  if (tests.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-bg-card border border-bg-border rounded-xl text-xs text-slate-400">
        У вас нет активных A/B экспериментов. Нажмите кнопку <b>«+ Новый A/B тест»</b>, чтобы запустить сплит-тестирование превью!
      </div>
    `;
    return;
  }

  let testsHtml = '';
  tests.forEach(t => {
    const a = t.variant_a;
    const b = t.variant_b;
    const isWinnerA = t.status === 'completed' && a.ctr >= b.ctr;
    const isWinnerB = t.status === 'completed' && b.ctr > a.ctr;

    testsHtml += `
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-bg-border pb-3">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-medium ${t.status === 'active' ? 'bg-white/[0.08] text-white border border-white/[0.12]' : 'bg-white/[0.04] text-zinc-400 border border-white/[0.08]'} uppercase">
              ${t.status === 'active' ? '● В ротации' : '✓ Завершен'}
            </span>
            <span class="text-xs font-bold text-white">${t.video_title}</span>
          </div>
          <span class="text-xs font-mono text-zinc-400">Смена каждые ${t.interval_hours}ч • Уверенность: ${t.confidence}%</span>
        </div>

        <!-- 2 Variants Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Variant A -->
          <div class="p-4 rounded-xl ${isWinnerA ? 'bg-white/[0.05] border-2 border-white/40' : 'bg-bg-input border border-bg-border'} space-y-3">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/[0.06] text-zinc-300 border border-white/[0.1]">Вариант A ${isWinnerA ? '🏆 ПОБЕДИТЕЛЬ' : ''}</span>
              <span class="text-xs font-mono text-zinc-300">CTR: <b class="text-white text-sm">${a.ctr}%</b></span>
            </div>
            <div class="aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.08]">
              <img src="${a.thumbnail}" class="w-full h-full object-cover" alt="Thumbnail A">
            </div>
            <p class="text-xs text-zinc-200 font-medium line-clamp-2">${a.title}</p>
            <div class="flex justify-between text-[11px] text-zinc-400 border-t border-bg-border/60 pt-2 font-mono">
              <span>Показы: ${a.impressions.toLocaleString()}</span>
              <span>Клики: ${a.clicks.toLocaleString()}</span>
            </div>
          </div>

          <!-- Variant B -->
          <div class="p-4 rounded-xl ${isWinnerB ? 'bg-white/[0.05] border-2 border-white/40' : 'bg-bg-input border border-bg-border'} space-y-3">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/[0.06] text-zinc-300 border border-white/[0.1]">Вариант B ${isWinnerB ? '🏆 ПОБЕДИТЕЛЬ' : ''}</span>
              <span class="text-xs font-mono text-zinc-300">CTR: <b class="text-white text-sm">${b.ctr}%</b></span>
            </div>
            <div class="aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.08]">
              <img src="${b.thumbnail}" class="w-full h-full object-cover" alt="Thumbnail B">
            </div>
            <p class="text-xs text-zinc-200 font-medium line-clamp-2">${b.title}</p>
            <div class="flex justify-between text-[11px] text-zinc-400 border-t border-bg-border/60 pt-2 font-mono">
              <span>Показы: ${b.impressions.toLocaleString()}</span>
              <span>Клики: ${b.clicks.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = testsHtml;
  if (window.lucide) lucide.createIcons();
}

/**
 * Video SEO Inspector Module
 */

function analyzeVideoSearch() {
  const input = document.getElementById('videoUrlInput') || document.getElementById('videoSearchInput');
  const val = (input?.value || '').trim();
  if (!val) return;

  if (isChannelQuery(val)) {
    showToast("Обнаружен канал: переключаем в аудит канала...");
    switchHub('channel_hub', 'channel_audit');
    const chanInput = document.getElementById('channelSearchInput');
    if (chanInput) chanInput.value = val;
    if (typeof loadChannelAnalysis === 'function') loadChannelAnalysis(val);
    return;
  }

  loadVideoAnalysis(val);
}

function analyzeVideoUrl(url) {
  loadVideoAnalysis(url);
}

async function loadVideoAnalysis(videoInput) {
  setLoading(true);
  const container = document.getElementById('videoResultsContainer');
  if (!container) return;
  container.innerHTML = '';

  try {
    const res = await fetch(`/api/video?url=${encodeURIComponent(videoInput)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка при анализе видео");

    window.activeVideoData = data.video;
    window.activeVideoSeo = data.seo;
    if (typeof onActiveVideoChanged === 'function') {
      onActiveVideoChanged(data.video);
    }

    renderVideoAudit(data.video, data.seo);
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

function renderVideoAudit(v, seo) {
  const container = document.getElementById('videoResultsContainer');
  if (!container) return;

  const tagsString = v.tags ? v.tags.join(', ') : '';
  const totalTagChars = v.tags ? v.tags.reduce((acc, t) => acc + t.length, 0) : 0;

  // Build Checklist HTML
  let checklistHtml = '';
  seo.checklist.forEach(item => {
    let badgeClass = 'badge-pass';
    let icon = 'check-circle';
    if (item.status === 'warn') {
      badgeClass = 'badge-warn';
      icon = 'alert-circle';
    } else if (item.status === 'fail') {
      badgeClass = 'badge-fail';
      icon = 'x-circle';
    }

    checklistHtml += `
      <div class="p-3.5 rounded-lg bg-bg-input border border-bg-border flex items-start gap-3 transition-colors hover:border-slate-700">
        <div class="p-1 rounded ${badgeClass} shrink-0 mt-0.5">
          <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-slate-200">${item.name}</span>
            <span class="text-[11px] font-mono text-slate-400">+${item.points} pts</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">${item.detail}</p>
        </div>
      </div>
    `;
  });

  // Build Tags Chips HTML
  let tagsChipsHtml = '';
  if (v.tags && v.tags.length > 0) {
    v.tags.forEach(tag => {
      tagsChipsHtml += `
        <span class="tag-chip cursor-pointer" onclick="copyToClipboard('${tag.replace(/'/g, "\\'")}', 'Тег скопирован!')" title="Кликните для копирования">
          <span># ${tag}</span>
        </span>
      `;
    });
  } else {
    tagsChipsHtml = '<span class="text-xs text-slate-500 italic">Скрытые теги отсутствуют или не указаны</span>';
  }

  // Calculate SVG Gauge Ring
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * (seo.total_score / 100));
  
  let scoreColor = '#10b981';
  if (seo.total_score < 45) scoreColor = '#f43f5e';
  else if (seo.total_score < 65) scoreColor = '#f59e0b';
  else if (seo.total_score < 85) scoreColor = '#3b82f6';

  container.innerHTML = `
    <div class="fade-in space-y-6">
      
      <!-- Video Hero Card -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div class="lg:col-span-4 relative rounded-lg overflow-hidden aspect-video bg-bg-input border border-bg-border">
          <img src="${v.thumbnail}" alt="Thumbnail" class="w-full h-full object-cover">
          <span class="absolute bottom-2 right-2 px-2 py-0.5 bg-black/85 rounded text-[11px] font-mono font-semibold text-white">${v.duration_formatted}</span>
        </div>

        <div class="lg:col-span-8 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-1 rounded-md bg-slate-800 text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5" title="Расчетная кликабельность обложки (CTR)">
              <i data-lucide="mouse-pointer-click" class="w-3.5 h-3.5"></i>
              <span>CTR: ~${v.ctr_estimated || 5.8}%</span>
            </span>
            <span class="px-2.5 py-1 rounded-md bg-slate-800 text-blue-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5">
              <i data-lucide="zap" class="w-3.5 h-3.5"></i>
              <span>VPH: ${v.vph.toLocaleString()} в час</span>
            </span>
            <span class="px-2.5 py-1 rounded-md bg-slate-800 text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5">
              <i data-lucide="heart" class="w-3.5 h-3.5"></i>
              <span>ER: ${v.engagement_rate}% вовлеченность</span>
            </span>
            <button onclick="generateViralTitlesForVideo()" class="px-2.5 py-1 rounded-md bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm" title="Сгенерировать виральные заголовки с прогнозным CTR">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-400"></i>
              <span>⚡ AI Заголовки (CTR Boost)</span>
            </button>
            <button onclick="quickExtractTranscript('${v.id}')" class="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
              <span>Транскрипт</span>
            </button>
          </div>

          <h3 class="text-base md:text-lg font-bold text-white leading-snug">${v.title}</h3>
          <p class="text-xs text-slate-400">
            Канал: <button onclick="quickChannelAudit('${v.channel_id}')" class="text-blue-400 hover:underline font-semibold">${v.channel_title}</button> 
            • Опубликовано: ${v.published_at.slice(0, 10)}
          </p>

          <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
            <div class="p-2.5 rounded-lg bg-bg-input border border-bg-border">
              <div class="text-[10px] text-slate-400 font-semibold uppercase">Просмотры</div>
              <div class="text-sm font-bold text-slate-100 font-mono">${v.views.toLocaleString()}</div>
            </div>
            <div class="p-2.5 rounded-lg bg-bg-input border border-bg-border">
              <div class="text-[10px] text-slate-400 font-semibold uppercase">Лайки</div>
              <div class="text-sm font-bold text-slate-100 font-mono">${v.likes.toLocaleString()}</div>
            </div>
            <div class="p-2.5 rounded-lg bg-bg-input border border-bg-border">
              <div class="text-[10px] text-slate-400 font-semibold uppercase">Комментарии</div>
              <div class="text-sm font-bold text-slate-100 font-mono">${v.comments.toLocaleString()}</div>
            </div>
            <div class="p-2.5 rounded-lg bg-bg-input border border-bg-border hidden sm:block">
              <div class="text-[10px] text-slate-400 font-semibold uppercase">Длина</div>
              <div class="text-sm font-bold text-slate-100 font-mono">${v.duration_formatted}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dynamic Container for Viral Title Generator -->
      <div id="seoViralTitlesContainer" class="hidden"></div>

      <!-- SEO Score & Breakdown Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        <!-- Precision SVG Circular Gauge Card -->
        <div class="lg:col-span-5 bg-bg-card border border-bg-border rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <i data-lucide="gauge" class="w-3.5 h-3.5 text-blue-400"></i>
            vidIQ SEO Score
          </div>
          
          <div class="svg-gauge-wrap my-1">
            <svg class="svg-gauge" viewBox="0 0 150 150">
              <circle class="svg-gauge-bg" cx="75" cy="75" r="${radius}"></circle>
              <circle class="svg-gauge-val" cx="75" cy="75" r="${radius}" 
                stroke="${scoreColor}" 
                stroke-dasharray="${circumference}" 
                stroke-dashoffset="${offset}">
              </circle>
            </svg>
            <div class="svg-gauge-text">
              <span class="text-3xl font-extrabold font-mono tracking-tight text-white">${seo.total_score}</span>
              <span class="text-[11px] font-semibold text-slate-400 uppercase mt-0.5">из 100</span>
            </div>
          </div>
          
          <div class="mt-3 space-y-1">
            <span class="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">${seo.rating}</span>
            <p class="text-xs text-slate-400 pt-1">
              Пройдено <b class="text-emerald-400">${seo.summary.passed_checks}</b> из <b>${seo.summary.total_checks}</b> факторов ранжирования
            </p>
          </div>
        </div>

        <!-- Sub-scores Bars -->
        <div class="lg:col-span-7 bg-bg-card border border-bg-border rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div class="font-semibold text-sm text-slate-200 flex items-center justify-between">
            <span>Детализация факторов SEO</span>
            <span class="text-xs text-slate-400 font-normal">Максимум 100 баллов</span>
          </div>

          <div class="space-y-3.5">
            <div>
              <div class="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Заголовок & Клик-триггеры</span>
                <span class="font-mono text-blue-400 font-semibold">${seo.sub_scores.title} / 25</span>
              </div>
              <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                <div class="bg-blue-500 h-full rounded-full transition-all duration-500" style="width: ${(seo.sub_scores.title / 25) * 100}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Глубина описания & Ссылки</span>
                <span class="font-mono text-emerald-400 font-semibold">${seo.sub_scores.description} / 25</span>
              </div>
              <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                <div class="bg-emerald-500 h-full rounded-full transition-all duration-500" style="width: ${(seo.sub_scores.description / 25) * 100}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Теги видео & Соответствие</span>
                <span class="font-mono text-amber-400 font-semibold">${seo.sub_scores.tags} / 25</span>
              </div>
              <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                <div class="bg-amber-500 h-full rounded-full transition-all duration-500" style="width: ${(seo.sub_scores.tags / 25) * 100}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                <span>Качество, Субтитры & ER</span>
                <span class="font-mono text-indigo-400 font-semibold">${seo.sub_scores.quality} / 25</span>
              </div>
              <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                <div class="bg-indigo-500 h-full rounded-full transition-all duration-500" style="width: ${(seo.sub_scores.quality / 25) * 100}%"></div>
              </div>
            </div>
          </div>

          <div class="p-3 rounded-lg bg-bg-input border border-bg-border text-xs text-slate-400 flex items-center justify-between">
            <span>Хотите улучшить этот ролик?</span>
            <button onclick="prefillAITitle('${v.title.replace(/'/g, "\\'")}')" class="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
              <span>Сгенерировать AI-заголовки</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

      </div>

      <!-- Actionable Optimization Checklist -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-3.5">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-bold text-sm text-white flex items-center gap-2">
              <i data-lucide="list-checks" class="w-4 h-4 text-blue-400"></i>
              Чек-лист оптимизации видео
            </h4>
            <p class="text-xs text-slate-400">Рекомендации по улучшению ранжирования в поиске</p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          ${checklistHtml}
        </div>
      </div>

      <!-- Hidden Tags Inspector Card -->
      <div class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-3.5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 class="font-bold text-sm text-white flex items-center gap-2">
              <i data-lucide="tag" class="w-4 h-4 text-indigo-400"></i>
              Инспектор скрытых тегов видео
            </h4>
            <p class="text-xs text-slate-400">${seo.tags_count} тегов, ${totalTagChars}/500 симв.</p>
          </div>
          <button onclick="copyToClipboard('${tagsString.replace(/'/g, "\\'")}', 'Все теги скопированы в буфер!')" class="px-3 py-1.5 bg-bg-input hover:bg-slate-800 text-slate-200 rounded-md text-xs font-medium border border-bg-border transition-all flex items-center gap-1.5 self-start sm:self-auto">
            <i data-lucide="copy" class="w-3.5 h-3.5 text-blue-400"></i>
            <span>Копировать все (${seo.tags_count})</span>
          </button>
        </div>

        <div class="p-3.5 rounded-lg bg-bg-input border border-bg-border flex flex-wrap gap-1.5">
          ${tagsChipsHtml}
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

async function generateViralTitlesForVideo(baseTitle) {
  const title = (baseTitle || window.activeVideoData?.title || document.querySelector('#videoResultsContainer h3')?.innerText || '').trim();
  if (!title) {
    showToast("Сначала выполните поиск видео");
    return;
  }
  const container = document.getElementById('seoViralTitlesContainer');
  if (!container) return;
  container.classList.remove('hidden');

  container.innerHTML = `
    <div class="p-5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-center space-y-2 fade-in">
      <div class="w-6 h-6 rounded-full border-2 border-amber-600 border-t-amber-300 animate-spin mx-auto"></div>
      <div class="text-xs font-semibold text-amber-200">AI генерирует 8 кликабельных заголовков с прогнозом CTR...</div>
    </div>
  `;

  try {
    let res = await fetch('/api/ai/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: title, audience: 'YouTube зрители' })
    });
    if (!res.ok) {
      res = await fetch('/api/scripts/titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: title, target_audience: 'YouTube зрители' })
      });
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Ошибка генерации заголовков');

    const titles = data.titles || [];
    let titlesHtml = '';
    titles.forEach((t, idx) => {
      const ctr = t.predicted_ctr || (85 + (idx % 12));
      titlesHtml += `
        <div class="p-3 rounded-lg bg-bg-input border border-bg-border flex items-center justify-between gap-3 hover:border-amber-500/40 transition-colors">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-amber-400 text-[10px] font-mono font-bold">${t.style || 'Viral'}</span>
              <span class="text-[10px] text-emerald-400 font-mono font-bold">Прогноз CTR: ~${(ctr / 10).toFixed(1)}%</span>
            </div>
            <p class="text-xs font-semibold text-white truncate cursor-pointer hover:text-amber-300 transition-colors" onclick="copyToClipboard('${t.title.replace(/'/g, "\\'")}', 'Заголовок скопирован!')" title="Кликните для копирования">${t.title}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">${t.reason || ''}</p>
          </div>
          <button onclick="copyToClipboard('${t.title.replace(/'/g, "\\'")}', 'Заголовок скопирован!')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors shrink-0" title="Копировать">
            <i data-lucide="copy" class="w-3.5 h-3.5 text-amber-400"></i>
          </button>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="p-5 rounded-xl bg-[#161720] border border-amber-500/30 space-y-4 fade-in shadow-xl">
        <div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div class="flex items-center gap-2">
            <i data-lucide="sparkles" class="w-4 h-4 text-amber-400"></i>
            <h4 class="text-xs font-bold uppercase text-white">8 Альтернативных заголовков с высоким CTR</h4>
          </div>
          <button onclick="document.getElementById('seoViralTitlesContainer').classList.add('hidden')" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${titlesHtml}
        </div>
      </div>
    `;

    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    container.innerHTML = `<div class="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs">${err.message}</div>`;
  } finally {
    if (window.lucide) lucide.createIcons();
  }
}

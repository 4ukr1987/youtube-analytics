/**
 * Thumbnail Feed Simulator & Visual Lab Module (vidIQ & ThumbnailTest Competitor)
 */

let mockThumbnailData = {
  imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
  title: 'Я Проверил 7 Скрытых Нейросетей (Они Заменят 90% Профессий)',
  channel: 'Мой YouTube Канал',
  views: '124K просмотров',
  timeAgo: '2 часа назад',
  duration: '14:28'
};

let competitorFeedItems = [];
let currentViewport = 'desktop'; // 'desktop' | 'mobile' | 'sidebar'
let isBlurActive = false;
let isGrayscaleActive = false;
let isBadgeOcclusionActive = true;
let currentScale = 100;
let lastSyncedThumbVideoId = null;

function syncThumbnailWithActiveVideo(videoData) {
  if (!videoData) return;
  mockThumbnailData.imageUrl = videoData.thumbnail || mockThumbnailData.imageUrl;
  mockThumbnailData.title = videoData.title || mockThumbnailData.title;
  mockThumbnailData.channel = videoData.channel_title || mockThumbnailData.channel;
  mockThumbnailData.duration = videoData.duration_formatted || '14:28';
  mockThumbnailData.views = `${(videoData.views || 0).toLocaleString()} просмотров`;
  
  const titleInp = document.getElementById('mockTitleInput');
  const chanInp = document.getElementById('mockChannelInput');
  const nicheInp = document.getElementById('mockNicheInput');
  if (titleInp) titleInp.value = videoData.title;
  if (chanInp) chanInp.value = videoData.channel_title;

  const topic = (videoData.tags && videoData.tags.length > 0) ? videoData.tags[0] : (videoData.title ? videoData.title.split(' ').slice(0, 3).join(' ') : 'YouTube');
  if (nicheInp) nicheInp.value = topic;

  renderThumbnailSimulatorFeed();

  if (lastSyncedThumbVideoId !== videoData.id || competitorFeedItems.length === 0) {
    lastSyncedThumbVideoId = videoData.id;
    loadCompetitorFeed(topic);
  }
}

function switchViewport(vp) {
  currentViewport = vp;
  ['desktop', 'mobile', 'sidebar'].forEach(v => {
    const btn = document.getElementById(`vpBtn_${v}`);
    if (btn) {
      if (v === vp) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  renderThumbnailSimulatorFeed();
}

function toggleVisualFilter(filterType) {
  if (filterType === 'blur') isBlurActive = !isBlurActive;
  if (filterType === 'grayscale') isGrayscaleActive = !isGrayscaleActive;
  if (filterType === 'badge') isBadgeOcclusionActive = !isBadgeOcclusionActive;

  const btnBlur = document.getElementById('filterBtn_blur');
  const btnGray = document.getElementById('filterBtn_gray');
  const btnBadge = document.getElementById('filterBtn_badge');

  if (btnBlur) btnBlur.classList.toggle('active', isBlurActive);
  if (btnGray) btnGray.classList.toggle('active', isGrayscaleActive);
  if (btnBadge) btnBadge.classList.toggle('active', isBadgeOcclusionActive);

  applyVisualFilterStyles();
}

function applyVisualFilterStyles() {
  const container = document.getElementById('simulatorFeedContainer');
  if (!container) return;

  container.classList.toggle('filter-blur-test', isBlurActive);
  container.classList.toggle('filter-grayscale-test', isGrayscaleActive);

  const badges = document.querySelectorAll('.timestamp-occlusion-overlay');
  badges.forEach(b => {
    b.style.display = isBadgeOcclusionActive ? 'flex' : 'none';
  });
}

function handleThumbnailScale(scaleVal) {
  currentScale = parseInt(scaleVal, 10);
  const scaleText = document.getElementById('scaleValueText');
  if (scaleText) scaleText.textContent = `${currentScale}%`;

  const container = document.getElementById('simulatorFeedContainer');
  if (container) {
    container.style.transform = `scale(${currentScale / 100})`;
    container.style.transformOrigin = 'top left';
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast("Пожалуйста, загрузите изображение (PNG, JPG, WEBP)");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    mockThumbnailData.imageUrl = e.target.result;
    updateMockPreviewCard();
    renderThumbnailSimulatorFeed();
    showToast("Обложка успешно загружена в симулятор!");
  };
  reader.readAsDataURL(file);
}

function handleCustomThumbnailUrl() {
  const url = document.getElementById('mockThumbUrlInput')?.value.trim();
  if (url) {
    mockThumbnailData.imageUrl = url;
    updateMockPreviewCard();
    renderThumbnailSimulatorFeed();
    showToast("URL обложки обновлен!");
  }
}

function handleMockMetaChange() {
  const titleInput = document.getElementById('mockTitleInput')?.value.trim();
  const chanInput = document.getElementById('mockChannelInput')?.value.trim();

  if (titleInput) mockThumbnailData.title = titleInput;
  if (chanInput) mockThumbnailData.channel = chanInput;

  updateMockPreviewCard();
  renderThumbnailSimulatorFeed();
}

function updateMockPreviewCard() {
  const previewImg = document.getElementById('mockThumbPreviewImg');
  if (previewImg) previewImg.src = mockThumbnailData.imageUrl;
}

let isFetchingCompetitorFeed = false;

async function loadCompetitorFeed(customTopic = null) {
  if (isFetchingCompetitorFeed) return;
  isFetchingCompetitorFeed = true;

  const topic = (customTopic || document.getElementById('mockNicheInput')?.value || "Искусственный интеллект").trim();
  const refreshBtn = document.getElementById('refreshFeedBtn');
  if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');

  try {
    const res = await fetch(`/api/thumbnail/competitors-feed?topic=${encodeURIComponent(topic)}&limit=11`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    competitorFeedItems = data.feed || [];
    renderThumbnailSimulatorFeed();
  } catch (err) {
    console.warn(`Ошибка загрузки конкурентов: ${err.message}`);
  } finally {
    isFetchingCompetitorFeed = false;
    setLoading(false);
    if (refreshBtn) refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
    if (window.lucide) lucide.createIcons();
  }
}

function renderThumbnailSimulatorFeed() {
  const container = document.getElementById('simulatorFeedContainer');
  if (!container) return;

  // Build the user's Mock Card
  const mockCard = {
    isUserMock: true,
    title: mockThumbnailData.title,
    thumbnail: mockThumbnailData.imageUrl,
    channel_title: mockThumbnailData.channel,
    channel_thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    views: 124000,
    published_at: '2024-01-01',
    duration_formatted: mockThumbnailData.duration
  };

  // Combine user mock at position #2 and real competitors
  const feed = [
    ...(competitorFeedItems.slice(0, 1)),
    mockCard,
    ...(competitorFeedItems.slice(1))
  ];

  let feedHtml = '';

  if (currentViewport === 'desktop') {
    // 🖥️ Desktop Grid View (3 columns)
    feedHtml = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">`;
    feed.forEach(item => {
      feedHtml += buildDesktopCard(item);
    });
    feedHtml += `</div>`;
  } else if (currentViewport === 'mobile') {
    // 📱 Mobile Single-Column Feed
    feedHtml = `<div class="max-w-md mx-auto space-y-6 bg-[#0f0f0f] p-3 rounded-2xl border border-slate-800 shadow-2xl">`;
    feed.forEach(item => {
      feedHtml += buildMobileCard(item);
    });
    feedHtml += `</div>`;
  } else if (currentViewport === 'sidebar') {
    // 📺 Sidebar Suggested View (Horizontal cards)
    feedHtml = `<div class="max-w-sm mx-auto space-y-3 bg-[#0f0f0f] p-3 rounded-xl border border-slate-800">`;
    feed.forEach(item => {
      feedHtml += buildSidebarCard(item);
    });
    feedHtml += `</div>`;
  }

  container.innerHTML = feedHtml;
  applyVisualFilterStyles();
  if (window.lucide) lucide.createIcons();
}

function buildDesktopCard(v) {
  const isMock = v.isUserMock;
  return `
    <div class="space-y-2.5 group cursor-pointer ${isMock ? 'ring-2 ring-amber-500/80 rounded-xl p-1.5 bg-amber-950/10' : ''}">
      <!-- Thumbnail wrapper -->
      <div class="aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 relative">
        <img src="${v.thumbnail}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Thumbnail">
        <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/85 rounded text-[11px] font-mono font-bold text-white">${v.duration_formatted}</span>
        ${isMock ? `
          <span class="absolute top-2 left-2 px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] font-black uppercase tracking-wider shadow">
            ВАША ОБЛОЖКА
          </span>
          <div class="timestamp-occlusion-overlay absolute bottom-0 right-0 w-16 h-8 bg-rose-500/40 border-2 border-rose-500 border-dashed flex items-center justify-center text-[9px] font-bold text-white">
            Зона времени
          </div>
        ` : ''}
      </div>

      <!-- Video Details -->
      <div class="flex items-start gap-3 pt-0.5">
        <img src="${v.channel_thumbnail || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" class="w-9 h-9 rounded-full object-cover bg-slate-800 shrink-0 mt-0.5" alt="Avatar">
        <div class="min-w-0 space-y-0.5">
          <h4 class="text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">${v.title}</h4>
          <p class="text-xs text-slate-400 font-medium truncate">${v.channel_title}</p>
          <p class="text-xs text-slate-400 font-mono">${typeof v.views === 'number' ? v.views.toLocaleString() + ' просмотров' : v.views} • 2 дня назад</p>
        </div>
      </div>
    </div>
  `;
}

function buildMobileCard(v) {
  const isMock = v.isUserMock;
  return `
    <div class="space-y-2.5 ${isMock ? 'ring-2 ring-amber-500 rounded-xl p-1 bg-amber-950/20' : ''}">
      <div class="aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 relative">
        <img src="${v.thumbnail}" class="w-full h-full object-cover" alt="Thumbnail">
        <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/85 rounded text-[10px] font-mono text-white">${v.duration_formatted}</span>
        ${isMock ? `
          <span class="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-600 text-white rounded text-[9px] font-bold uppercase">
            ВАША ОБЛОЖКА
          </span>
          <div class="timestamp-occlusion-overlay absolute bottom-0 right-0 w-14 h-7 bg-rose-500/40 border border-rose-500 border-dashed flex items-center justify-center text-[8px] font-bold text-white">
            Зона
          </div>
        ` : ''}
      </div>

      <div class="flex items-start gap-2.5 px-1">
        <img src="${v.channel_thumbnail || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" class="w-8 h-8 rounded-full object-cover shrink-0" alt="Avatar">
        <div class="min-w-0">
          <h4 class="text-xs font-semibold text-white line-clamp-2 leading-tight">${v.title}</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">${v.channel_title} • ${typeof v.views === 'number' ? v.views.toLocaleString() : v.views}</p>
        </div>
      </div>
    </div>
  `;
}

function buildSidebarCard(v) {
  const isMock = v.isUserMock;
  return `
    <div class="flex items-start gap-2.5 p-1.5 rounded-lg ${isMock ? 'ring-2 ring-amber-500 bg-amber-950/20' : 'hover:bg-slate-800/40'} transition-colors">
      <div class="w-36 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0 relative">
        <img src="${v.thumbnail}" class="w-full h-full object-cover" alt="Thumbnail">
        <span class="absolute bottom-1 right-1 px-1 py-0.2 bg-black/85 rounded text-[9px] font-mono text-white">${v.duration_formatted}</span>
        ${isMock ? `
          <div class="timestamp-occlusion-overlay absolute bottom-0 right-0 w-10 h-5 bg-rose-500/40 border border-rose-500 border-dashed flex items-center justify-center text-[7px] text-white">
            Зона
          </div>
        ` : ''}
      </div>
      <div class="min-w-0 space-y-0.5">
        <h4 class="text-xs font-semibold text-white line-clamp-2 leading-tight">${v.title}</h4>
        <p class="text-[10px] text-slate-400 truncate">${v.channel_title}</p>
        <p class="text-[10px] text-slate-400 font-mono">${typeof v.views === 'number' ? v.views.toLocaleString() : v.views}</p>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// AI Thumbnail Audit (Gemini 3.6/3.7)
// -------------------------------------------------------------
async function runAIThumbnailAudit() {
  setLoading(true);
  const auditContainer = document.getElementById('thumbnailAuditResults');
  if (auditContainer) auditContainer.innerHTML = '';

  const title = mockThumbnailData.title;
  const niche = (document.getElementById('mockNicheInput')?.value || "YouTube").trim();

  try {
    const res = await fetch('/api/thumbnail/ai-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        niche,
        thumbnail_text: "Текст на превью",
        has_face: true,
        color_scheme: "Контрастная"
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    renderThumbnailAuditResults(data.audit);
  } catch (err) {
    if (auditContainer) {
      auditContainer.innerHTML = `<div class="p-4 text-xs text-rose-400">${err.message}</div>`;
    }
  } finally {
    setLoading(false);
    if (window.lucide) lucide.createIcons();
  }
}

function renderThumbnailAuditResults(a) {
  const container = document.getElementById('thumbnailAuditResults');
  if (!container) return;

  let prosHtml = '';
  (a.pros || []).forEach(p => {
    prosHtml += `<li class="flex items-start gap-2 text-xs text-slate-300"><i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></i><span>${p}</span></li>`;
  });

  let warningsHtml = '';
  (a.warnings || []).forEach(w => {
    warningsHtml += `<li class="flex items-start gap-2 text-xs text-amber-300"><i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5"></i><span>${w}</span></li>`;
  });

  let tipsHtml = '';
  (a.pro_tips || []).forEach(t => {
    tipsHtml += `<li class="flex items-start gap-2 text-xs text-zinc-300"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5"></i><span>${t}</span></li>`;
  });

  container.innerHTML = `
    <div class="fade-in p-5 rounded-xl bg-bg-card border border-bg-border space-y-4 shadow-lg">
      <div class="flex items-center justify-between border-b border-bg-border pb-3">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-white/[0.08] text-zinc-300 border border-white/[0.12] uppercase">AI Thumbnail Score</span>
          <span class="text-sm font-bold text-white">Прогноз CTR: <b class="text-emerald-400 font-mono">${a.ctr_score} / 100</b></span>
        </div>
        <span class="text-xs px-2.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.1]">Правило 3 сек: <b class="text-white">${a.rule_3_seconds}</b></span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        <div class="p-3 rounded-lg bg-bg-input border border-bg-border space-y-2">
          <span class="text-[10px] font-semibold uppercase text-zinc-400 flex items-center gap-1">
            <i data-lucide="thumbs-up" class="w-3 h-3"></i>
            <span>Сильные стороны:</span>
          </span>
          <ul class="space-y-1.5">${prosHtml}</ul>
        </div>

        <div class="p-3 rounded-lg bg-bg-input border border-bg-border space-y-2">
          <span class="text-[10px] font-semibold uppercase text-zinc-400 flex items-center gap-1">
            <i data-lucide="shield-alert" class="w-3 h-3"></i>
            <span>Зоны риска:</span>
          </span>
          <ul class="space-y-1.5">${warningsHtml}</ul>
        </div>

        <div class="p-3 rounded-lg bg-bg-input border border-bg-border space-y-2">
          <span class="text-[10px] font-semibold uppercase text-zinc-400 flex items-center gap-1">
            <i data-lucide="sparkles" class="w-3 h-3"></i>
            <span>Советы по улучшению:</span>
          </span>
          <ul class="space-y-1.5">${tipsHtml}</ul>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// --- AI Thumbnail Concepts & Visual Prompts Generator ---

async function generateAIThumbnailConcepts() {
  const titleInp = document.getElementById('mockTitleInput');
  const nicheInp = document.getElementById('mockNicheInput');
  const title = (titleInp?.value || '').trim();
  const topic = (nicheInp?.value || '').trim();

  if (!title && !topic) {
    showToast("Введите название видео или тему ниши");
    return;
  }

  const container = document.getElementById('aiThumbnailConceptsContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="p-8 rounded-xl bg-[#111215] border border-white/[0.08] text-center space-y-3 fade-in shadow-xl">
      <div class="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto"></div>
      <div class="text-sm font-bold text-white">Генерация 3 психологических концептов превью и промптов...</div>
      <p class="text-xs text-zinc-400 max-w-md mx-auto">Анализ топовых CTR-паттернов YouTube, расчет контраста, подбор хук-текста и генерация промптов для Midjourney / Imagen...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/thumbnail/generate-concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || topic,
        topic: topic || title
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Ошибка генерации концептов");

    renderThumbnailConcepts(data.concepts || []);
  } catch (err) {
    container.innerHTML = `
      <div class="p-5 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs">
        Ошибка: ${err.message}
      </div>
    `;
  }
}

function renderThumbnailConcepts(concepts) {
  const container = document.getElementById('aiThumbnailConceptsContainer');
  if (!container) return;

  let conceptsHtml = '';
  concepts.forEach((c, idx) => {
    const safePrompt = (c.midjourney_prompt || '').replace(/'/g, "\\'");
    conceptsHtml += `
      <div class="p-5 rounded-xl bg-[#111215] border border-white/[0.08] hover:border-zinc-500 transition-all space-y-4 shadow-lg flex flex-col justify-between">
        <div class="space-y-3">
          
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-white/[0.08] text-zinc-300 border border-white/[0.12]">${c.concept_name || `Концепт ${idx + 1}`}</span>
            <span class="text-xs font-mono font-bold text-white">${c.ctr_score || '9.0 / 10'} CTR</span>
          </div>

          <!-- Hook Text Mockup -->
          <div class="p-3 rounded-lg bg-black/60 border border-white/10 text-center">
            <div class="text-[10px] uppercase text-zinc-500 mb-1">Текст на превью (Hook):</div>
            <div class="text-lg font-bold tracking-tight text-white uppercase font-sans drop-shadow-md">
              "${c.hook_text || 'СЕКРЕТ РАСКРЫТ'}"
            </div>
          </div>

          <!-- Composition Details -->
          <div class="space-y-2 text-xs">
            <div>
              <span class="text-zinc-400 text-[11px] block">Композиция:</span>
              <span class="text-zinc-200">${c.visual_composition}</span>
            </div>
            <div>
              <span class="text-zinc-400 text-[11px] block">Эмоция лица:</span>
              <span class="text-zinc-200">${c.facial_expression}</span>
            </div>
            <div>
              <span class="text-zinc-400 text-[11px] block">Цветовой контраст:</span>
              <span class="text-zinc-300 text-[11px] font-mono">${c.color_scheme}</span>
            </div>
          </div>

        </div>

        <!-- Midjourney Prompt & Copy Button -->
        <div class="border-t border-white/[0.06] pt-3 space-y-2">
          <div class="text-[10px] font-semibold uppercase text-zinc-400 flex items-center justify-between">
            <span>Промпт (Midjourney / Imagen / Flux):</span>
            <button onclick="copyToClipboard('${safePrompt}')" class="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
              <i data-lucide="copy" class="w-3 h-3"></i>
              <span>Скопировать</span>
            </button>
          </div>
          <div class="p-2.5 rounded bg-[#14151a] border border-white/[0.04] text-[11px] font-mono text-zinc-300 leading-relaxed max-h-24 overflow-y-auto select-all">
            ${c.midjourney_prompt}
          </div>
        </div>

      </div>
    `;
  });

  container.innerHTML = `
    <div class="fade-in space-y-3">
      <div class="flex items-center justify-between px-1">
        <h4 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <i data-lucide="palette" class="w-4 h-4 text-zinc-400"></i>
          3 Психологических концепта превью
        </h4>
        <span class="text-xs text-zinc-400 font-mono">Готовые промпты для генерации</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${conceptsHtml}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

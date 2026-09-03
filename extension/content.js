/**
 * Content Script injected on youtube.com
 * Fetches analytics from local suite http://127.0.0.1:8000
 */

let lastVideoId = null;

function initAnalyticsWidget() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('v');

  if (!videoId || videoId === lastVideoId) return;
  lastVideoId = videoId;

  // Remove existing widget if any
  const oldWidget = document.getElementById('yt-analytics-growth-widget');
  if (oldWidget) oldWidget.remove();

  // Find insertion anchor (underneath the video secondary info / above comments)
  const targetParent = document.querySelector('#secondary-inner') || document.querySelector('#secondary') || document.querySelector('#below');
  if (!targetParent) {
    setTimeout(initAnalyticsWidget, 1000);
    return;
  }

  // Create loading placeholder
  const widget = document.createElement('div');
  widget.id = 'yt-analytics-growth-widget';
  widget.innerHTML = `
    <div class="ytg-header">
      <div class="ytg-title-box">
        <span class="ytg-badge">Growth Suite</span>
        <span class="ytg-title">Загрузка аналитики...</span>
      </div>
    </div>
  `;

  targetParent.prepend(widget);

  // Fetch data from local FastAPI server
  fetch(`http://127.0.0.1:8000/api/video?url=${encodeURIComponent(window.location.href)}`)
    .then(res => res.json())
    .then(data => {
      renderWidgetData(widget, data, videoId);
    })
    .catch(err => {
      widget.innerHTML = `
        <div class="ytg-header">
          <div class="ytg-title-box">
            <span class="ytg-badge">Growth Suite</span>
            <span class="ytg-title">Локальный сервер не запущен</span>
          </div>
        </div>
        <p style="font-size: 11px; color: #94a3b8; line-height: 1.4;">
          Запустите приложение YouTube Growth Suite на <a href="http://127.0.0.1:8000" target="_blank" style="color: #60a5fa;">http://127.0.0.1:8000</a> для вывода SEO-балла и скрытых тегов.
        </p>
      `;
    });
}

function renderWidgetData(widget, data, videoId) {
  const seo = data.seo_analysis || {};
  const overview = data.overview || {};
  const tags = data.tags || [];

  const score = seo.score || 75;
  const vph = overview.views ? Math.round(overview.views / 240) : 150;
  const viewsStr = overview.views ? Number(overview.views).toLocaleString() : '—';

  let tagsHtml = '';
  tags.forEach(t => {
    tagsHtml += `<span class="ytg-tag-chip">${t}</span>`;
  });

  widget.innerHTML = `
    <div class="ytg-header">
      <div class="ytg-title-box">
        <span class="ytg-badge">Growth Suite</span>
        <span class="ytg-title">SEO & Виральность</span>
      </div>
      <a href="http://127.0.0.1:8000" target="_blank" style="font-size: 10px; color: #60a5fa; text-decoration: none; font-weight: 600;">В студию ↗</a>
    </div>

    <div class="ytg-stats-grid">
      <div class="ytg-stat-card">
        <div class="ytg-stat-label">SEO Score</div>
        <div class="ytg-stat-value score">${score}/100</div>
      </div>
      <div class="ytg-stat-card">
        <div class="ytg-stat-label">Скорость</div>
        <div class="ytg-stat-value vph">~${vph.toLocaleString()} VPH</div>
      </div>
      <div class="ytg-stat-card">
        <div class="ytg-stat-label">Просмотры</div>
        <div class="ytg-stat-value">${viewsStr}</div>
      </div>
    </div>

    ${tags.length > 0 ? `
      <div class="ytg-tags-section">
        <div class="ytg-tags-header">
          <span class="ytg-tags-title">Скрытые теги (${tags.length}):</span>
          <button id="ytgCopyTagsBtn" class="ytg-copy-btn">Копировать все</button>
        </div>
        <div class="ytg-tags-container">
          ${tagsHtml}
        </div>
      </div>
    ` : '<div style="font-size: 11px; color: #94a3b8; margin-bottom: 10px;">Теги не указаны автором</div>'}

    <a href="http://127.0.0.1:8000" target="_blank" class="ytg-footer-btn">
      ⚡ Открыть полный аудит и транскрипт
    </a>
  `;

  const copyBtn = widget.querySelector('#ytgCopyTagsBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(tags.join(', '));
      copyBtn.textContent = 'Скопировано!';
      setTimeout(() => { copyBtn.textContent = 'Копировать все'; }, 2000);
    });
  }
}

// Watch for YouTube single-page navigation
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (url.includes('/watch?v=')) {
      setTimeout(initAnalyticsWidget, 1000);
    }
  }
}).observe(document, { subtree: true, childList: true });

if (window.location.href.includes('/watch?v=')) {
  setTimeout(initAnalyticsWidget, 1500);
}

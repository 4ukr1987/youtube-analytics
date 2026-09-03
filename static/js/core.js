/**
 * Core Application Framework (5-Hub Architecture & Smart Omnibar)
 */

let activeHub = 'video_hub';
let activeSubtabs = {
  video_hub: 'video_seo',
  channel_hub: 'channel_audit',
  ai_hub: 'daily_ideas',
  trends_hub: 'harvester',
  tools_hub: 'history'
};

// System Health Check
async function checkSystemHealth() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const badgeText = document.getElementById('apiStatusText');
    if (badgeText) {
      if (data.youtube_api_configured) {
        badgeText.textContent = "YouTube API Active";
      } else {
        badgeText.textContent = "Demo Mode (Mock API)";
      }
    }

    // Update Database Vault Stats
    try {
      const dbRes = await fetch('/api/database/stats');
      const dbData = await dbRes.json();
      if (dbData.status === 'success' && dbData.stats) {
        const s = dbData.stats;
        const dbBadge = document.getElementById('dbVaultStatusBadge');
        const dbText = document.getElementById('dbVaultStatusText');
        if (dbBadge && dbText) {
          dbBadge.classList.remove('hidden');
          dbText.textContent = `База: ${s.total_videos} видео (${s.requests_saved} сэкономлено)`;
          dbBadge.title = `Локальная база данных SQLite:\n• Видео в базе: ${s.total_videos}\n• Каналов: ${s.total_channels}\n• Транскриптов: ${s.total_transcripts}\n• Сэкономлено запросов API: ${s.requests_saved} (${s.saved_percentage}%)`;
        }
      }
    } catch (dbErr) {
      console.warn("DB stats fetch failed:", dbErr);
    }

  } catch (e) {
    console.warn("Status check failed:", e);
  }
}

// Loading state toggle
function setLoading(isLoading) {
  const loader = document.getElementById('loadingState');
  if (!loader) return;
  if (isLoading) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

// Mobile slide-over drawer toggle
function toggleMobileMenu(isOpen) {
  const sidebar = document.getElementById('mainSidebar');
  const backdrop = document.getElementById('mobileBackdrop');
  if (!sidebar) return;
  
  const shouldOpen = isOpen !== undefined ? isOpen : sidebar.classList.contains('-translate-x-full');
  if (shouldOpen) {
    sidebar.classList.remove('-translate-x-full');
    if (backdrop) backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

// Primary 5-Hub Switcher
function switchHub(hubKey, targetSubtab = null) {
  activeHub = hubKey;
  
  // Auto-close mobile drawer on selection
  toggleMobileMenu(false);
  
  // Update sidebar hub buttons
  ['video_hub', 'channel_hub', 'ai_hub', 'trends_hub', 'tools_hub'].forEach(h => {
    const btn = document.getElementById(`hubNav_${h}`);
    const section = document.getElementById(`hubSection_${h}`);
    if (btn) btn.classList.toggle('active', h === hubKey);
    if (section) section.classList.toggle('hidden', h !== hubKey);

    // Update bottom navigation bar button styles
    const bottomBtn = document.getElementById(`bottomNav_${h}`);
    if (bottomBtn) {
      if (h === hubKey) {
        bottomBtn.classList.add('text-white', 'bg-white/[0.08]');
        bottomBtn.classList.remove('text-zinc-400');
      } else {
        bottomBtn.classList.remove('text-white', 'bg-white/[0.08]');
        bottomBtn.classList.add('text-zinc-400');
      }
    }
  });

  const subtab = targetSubtab || activeSubtabs[hubKey];
  switchSubtab(hubKey, subtab);
}

// Subtab switcher within an active Hub
function switchSubtab(hubKey, subtabKey) {
  activeSubtabs[hubKey] = subtabKey;

  // Deactivate all subtabs in this hub
  const hubSection = document.getElementById(`hubSection_${hubKey}`);
  if (!hubSection) return;

  const subtabButtons = hubSection.querySelectorAll('.subtab-btn');
  subtabButtons.forEach(btn => {
    const isTarget = btn.getAttribute('data-subtab') === subtabKey;
    btn.classList.toggle('active', isTarget);
    if (isTarget) {
      btn.style.backgroundColor = '#1e2030';
      btn.style.color = '#ffffff';
      btn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      btn.style.fontWeight = '600';
      btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)';
    } else {
      btn.style.backgroundColor = 'transparent';
      btn.style.color = '#94a3b8';
      btn.style.border = '1px solid transparent';
      btn.style.fontWeight = '500';
      btn.style.boxShadow = 'none';
    }
  });

  const subPanels = hubSection.querySelectorAll('.subtab-panel');
  subPanels.forEach(panel => {
    const isTarget = panel.getAttribute('data-panel') === subtabKey;
    panel.classList.toggle('hidden', !isTarget);
  });

  // Context synchronization across subtabs
  if (hubKey === 'video_hub' && window.activeVideoData) {
    if (subtabKey === 'thumbnail_preview' && typeof syncThumbnailWithActiveVideo === 'function') {
      syncThumbnailWithActiveVideo(window.activeVideoData);
    } else if (subtabKey === 'transcripts' && typeof syncTranscriptWithActiveVideo === 'function') {
      syncTranscriptWithActiveVideo(window.activeVideoData);
    } else if (subtabKey === 'comments_mining' && window.activeVideoData.id) {
      const cInp = document.getElementById('commentsVideoInput');
      if (cInp && !cInp.value) {
        cInp.value = `https://www.youtube.com/watch?v=${window.activeVideoData.id}`;
        if (typeof mineAudiencePainPoints === 'function') {
          mineAudiencePainPoints(window.activeVideoData.id, window.activeVideoData.title);
        }
      }
    }
  } else if (hubKey === 'channel_hub' && window.activeChannelOverview) {
    if (subtabKey === 'best_time' && typeof syncBestTimeWithActiveChannel === 'function') {
      syncBestTimeWithActiveChannel(window.activeChannelOverview);
    }
  }

  // Trigger lazy loading where appropriate
  if (subtabKey === 'daily_ideas' && typeof loadDailyIdeas === 'function') loadDailyIdeas('new');
  if (subtabKey === 'thumbnail_preview' && typeof loadCompetitorFeed === 'function') {
    if (!window.activeVideoData && (!competitorFeedItems || competitorFeedItems.length === 0)) loadCompetitorFeed();
  }
  if (subtabKey === 'best_time' && typeof loadBestTimeHeatmap === 'function') {
    if (!window.activeChannelOverview && !cachedBestTimeData) loadBestTimeHeatmap();
  }
  if (subtabKey === 'history' && typeof loadWatchlistView === 'function') loadWatchlistView();
  if (subtabKey === 'studio' && typeof loadStudioAnalyticsView === 'function') loadStudioAnalyticsView();
  if (subtabKey === 'ab_testing' && typeof loadABTestsView === 'function') loadABTestsView();

  if (window.lucide) {
    lucide.createIcons();
  }
}

// Global Video & Channel Context Change Handlers
function onActiveVideoChanged(videoData) {
  if (!videoData) return;
  const banner = document.getElementById('activeVideoBanner');
  const thumb = document.getElementById('activeVideoBannerThumb');
  const title = document.getElementById('activeVideoBannerTitle');
  const meta = document.getElementById('activeVideoBannerMeta');
  if (banner && thumb && title && meta) {
    thumb.src = videoData.thumbnail;
    title.textContent = videoData.title;
    meta.textContent = `${videoData.channel_title} • ${videoData.duration_formatted || ''}`;
    banner.classList.remove('hidden');
  }

  if (typeof syncThumbnailWithActiveVideo === 'function') {
    syncThumbnailWithActiveVideo(videoData);
  }
  if (typeof syncTranscriptWithActiveVideo === 'function') {
    syncTranscriptWithActiveVideo(videoData);
  }
}

function onActiveChannelChanged(channelData) {
  if (!channelData) return;
  const banner = document.getElementById('activeChannelBanner');
  const thumb = document.getElementById('activeChannelBannerThumb');
  const title = document.getElementById('activeChannelBannerTitle');
  const meta = document.getElementById('activeChannelBannerMeta');
  if (banner && thumb && title && meta) {
    thumb.src = channelData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde';
    title.textContent = channelData.title;
    meta.textContent = `${channelData.custom_url || ''} • ${(channelData.subscriber_count || 0).toLocaleString()} сабов`;
    banner.classList.remove('hidden');
  }

  if (typeof syncBestTimeWithActiveChannel === 'function') {
    syncBestTimeWithActiveChannel(channelData);
  }
}

// Global Toast Notification
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.remove('opacity-0', 'translate-y-16', 'pointer-events-none');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-16', 'pointer-events-none');
  }, 3000);
}

// Clipboard Helpers
function copyToClipboard(text, msg = "Скопировано в буфер обмена!") {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  showToast(msg);
}

function copyText(text) {
  copyToClipboard(text, "Скопировано в буфер обмена!");
}

// Smart Omnibar: Auto-routes input to appropriate hub
function handleOmnibarSubmit(e) {
  if (e) e.preventDefault();
  const rawQuery = (document.getElementById('omnibarInput')?.value || '').trim();
  if (!rawQuery) return;

  // 1. If video URL or standard 11-char ID -> Video Hub
  if (rawQuery.includes('youtube.com/watch') || rawQuery.includes('youtu.be/') || (rawQuery.length === 11 && !rawQuery.includes(' '))) {
    switchHub('video_hub', 'video_seo');
    const input = document.getElementById('videoUrlInput');
    if (input) input.value = rawQuery;
    analyzeVideoUrl(rawQuery);
    return;
  }

  // 2. If channel handle (@...) or channel URL -> Channel Hub
  if (rawQuery.startsWith('@') || rawQuery.includes('youtube.com/@') || rawQuery.includes('youtube.com/channel/')) {
    switchHub('channel_hub', 'channel_audit');
    const input = document.getElementById('channelSearchInput');
    if (input) input.value = rawQuery;
    analyzeChannel(rawQuery);
    return;
  }

  // 3. Otherwise treat as Niche Topic / Keywords -> Trends Hub
  switchHub('trends_hub', 'niche_outliers');
  const outlierInput = document.getElementById('outlierSearchInput');
  if (outlierInput) outlierInput.value = rawQuery;
  loadNicheOutliers(rawQuery);
}

// Query Type Detectors
function isChannelQuery(str) {
  if (!str) return false;
  return str.startsWith('@') || str.includes('youtube.com/@') || str.includes('youtube.com/channel/') || str.includes('youtube.com/c/');
}

function isVideoQuery(str) {
  if (!str) return false;
  return str.includes('youtube.com/watch') || str.includes('youtu.be/') || (str.length === 11 && !str.includes(' '));
}

// Quick Search Preset helper
function quickSearch(query) {
  const omni = document.getElementById('omnibarInput');
  if (omni) omni.value = query;
  handleOmnibarSubmit();
}

// 1-Click Report Exporter (Markdown / PDF)
function exportAuditReport(type = 'markdown') {
  if (type === 'print') {
    window.print();
    return;
  }

  let content = '';
  let filename = `report_${Date.now()}.md`;

  if (activeHub === 'channel_hub' && window.activeChannelData) {
    const ov = window.activeChannelData.overview;
    const an = window.activeChannelData.analytics;
    filename = `Channel_Audit_${(ov.title || 'channel').replace(/\s+/g, '_')}.md`;
    content = `# 📊 Аудит YouTube Канала: ${ov.title}\n\n` +
      `- **Ссылка**: https://www.youtube.com/${ov.custom_url || ov.id}\n` +
      `- **Подписчики**: ${(ov.subscribers || 0).toLocaleString()}\n` +
      `- **Всего просмотров**: ${(ov.total_views || 0).toLocaleString()}\n` +
      `- **Всего видео**: ${ov.video_count || 0}\n` +
      `- **Медиана просмотров**: ${(an.median_views || 0).toLocaleString()}\n` +
      `- **Регулярность**: ${an.cadence?.videos_per_week || 2.5} видео/нед\n` +
      `- **Вовлеченность (ER)**: ${an.avg_engagement_rate || 0}%\n\n` +
      `## 🎬 Топ видео и виральные аномалии:\n\n` +
      `| Название | Просмотры | CTR (Est.) | Outlier Rate | VPH |\n` +
      `|---|---|---|---|---|\n`;

    (an.recent_videos || []).forEach(v => {
      content += `| ${v.title} | ${(v.views || 0).toLocaleString()} | ${v.ctr_estimated || 5.2}% | x${v.outlier_multiplier || 1.0} | ${v.vph || 0} |\n`;
    });
  } else if (activeHub === 'video_hub') {
    const title = document.querySelector('#videoResultsContainer h3')?.innerText || 'Видео анализ';
    filename = `Video_SEO_${Date.now()}.md`;
    content = `# 🎬 SEO Отчет видео: ${title}\n\n` +
      `Дата экспорта: ${new Date().toLocaleDateString()}\n\n` +
      `Отчет сгенерирован в YouTube Growth Studio.\n`;
  } else {
    showToast("Сначала выполните поиск канала или видео для экспорта");
    return;
  }

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  showToast("Отчет экспортирован в Markdown!");
}

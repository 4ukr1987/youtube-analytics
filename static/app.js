/**
 * Main Application Bootstrap
 * Initializes Lucide Icons, Status Check, and Global Hub Routing.
 */

function quickInspectVideo(videoId) {
  switchHub('video_hub', 'video_seo');
  const input = document.getElementById('videoUrlInput');
  if (input) input.value = videoId;
  analyzeVideoUrl(videoId);
}

function quickChannelAudit(channelId) {
  switchHub('channel_hub', 'channel_audit');
  const input = document.getElementById('channelSearchInput');
  if (input) input.value = channelId;
  analyzeChannel(channelId);
}

function quickExtractTranscript(videoId) {
  switchHub('video_hub', 'transcripts');
  const input = document.getElementById('transcriptSearchInput');
  if (input) input.value = videoId;
  extractTranscriptSearch();
}

function checkSystemStatus() {
  if (typeof checkSystemHealth === 'function') {
    checkSystemHealth();
  }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  checkSystemStatus();
  switchHub('video_hub', 'video_seo');
});

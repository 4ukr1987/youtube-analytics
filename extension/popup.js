document.getElementById('openStudioBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://127.0.0.1:8000' });
});

document.getElementById('openOutliersBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://127.0.0.1:8000' });
});

document.getElementById('openDailyIdeasBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://127.0.0.1:8000' });
});

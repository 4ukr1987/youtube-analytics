/**
 * AI Daily Ideas Component (vidIQ Boost Feature)
 */

let currentDailyIdeasStatus = 'new';

function switchDailyIdeasSubtab(status) {
  currentDailyIdeasStatus = status;
  ['new', 'saved', 'dismissed'].forEach(s => {
    const btn = document.getElementById(`dailyTab_${s}`);
    if (btn) {
      if (s === status) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  const niche = (document.getElementById('dailyIdeasNicheInput')?.value || "YouTube & ИИ").trim();
  loadDailyIdeas(status, niche);
}

async function generateFreshDailyIdeas() {
  const nicheInput = document.getElementById('dailyIdeasNicheInput');
  const niche = (nicheInput?.value || "YouTube & ИИ").trim();
  setLoading(true);

  try {
    const res = await fetch('/api/daily-ideas/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    showToast("Сгенерировано 5 свежих вирусных идей!");
    renderDailyIdeas(data.ideas, 'new');
  } catch (err) {
    showToast(`Ошибка: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

async function loadDailyIdeas(status = 'new', niche = null) {
  if (!niche) {
    niche = (document.getElementById('dailyIdeasNicheInput')?.value || "YouTube & ИИ").trim();
  }
  setLoading(true);
  const container = document.getElementById('dailyIdeasContainer');
  if (container) container.innerHTML = '';

  try {
    const res = await fetch(`/api/daily-ideas?niche=${encodeURIComponent(niche)}&status=${status}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    renderDailyIdeas(data.ideas || [], status);
  } catch (err) {
    if (container) container.innerHTML = `<div class="p-4 text-xs text-rose-400 bg-rose-950/20 border border-rose-800/40 rounded-xl">${err.message}</div>`;
  } finally {
    setLoading(false);
    if (window.lucide) lucide.createIcons();
  }
}

async function setDailyIdeaStatus(ideaId, newStatus) {
  try {
    const res = await fetch('/api/daily-ideas/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ideaId, status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);

    if (newStatus === 'saved') showToast("Идея сохранена в избранное ❤️");
    else if (newStatus === 'dismissed') showToast("Идея перемещена в архив ✕");
    else showToast("Идея возвращена в ленту");

    const card = document.getElementById(`daily_card_${ideaId}`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => card.remove(), 250);
    }
  } catch (err) {
    showToast(err.message);
  }
}

function renderDailyIdeas(ideas, activeStatus) {
  const container = document.getElementById('dailyIdeasContainer');
  if (!container) return;

  if (!ideas || ideas.length === 0) {
    let emptyMsg = "На сегодня все идеи просмотрены. Нажмите «Сгенерировать 5 идей», чтобы получить свежую подборку!";
    if (activeStatus === 'saved') emptyMsg = "У вас пока нет сохраненных идей. Нажмите ❤️ на любой карточке в ленте «Новые на сегодня».";
    if (activeStatus === 'dismissed') emptyMsg = "Архив пуст.";

    container.innerHTML = `
      <div class="p-12 text-center bg-bg-card border border-bg-border rounded-xl space-y-3">
        <div class="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <i data-lucide="inbox" class="w-6 h-6"></i>
        </div>
        <p class="text-xs text-slate-400 max-w-md mx-auto">${emptyMsg}</p>
        ${activeStatus === 'new' ? `
          <button onclick="generateFreshDailyIdeas()" class="btn-amber text-xs">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            <span>Сгенерировать новые идеи</span>
          </button>
        ` : ''}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let cardsHtml = '';
  ideas.forEach(idea => {
    let potentialBadgeClass = 'bg-rose-950/60 text-rose-400 border-rose-800/60';
    let potentialIcon = '🔥';
    if (idea.potential_score >= 90) {
      potentialBadgeClass = 'bg-rose-950/50 text-rose-300 border-rose-800/50';
      potentialIcon = '🔥';
    } else if (idea.potential_score >= 80) {
      potentialBadgeClass = 'bg-amber-950/50 text-amber-300 border-amber-800/50';
      potentialIcon = '⚡';
    } else {
      potentialBadgeClass = 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50';
      potentialIcon = '✨';
    }

    cardsHtml += `
      <div id="daily_card_${idea.id}" class="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4 hover:border-slate-700 transition-all duration-300 shadow-sm">
        
        <!-- Header row -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded text-xs font-bold ${potentialBadgeClass} border flex items-center gap-1">
              <span>${potentialIcon} ${idea.potential_badge} POTENTIAL</span>
            </span>
            <span class="text-xs font-mono font-bold text-amber-400">Score: ${idea.potential_score}%</span>
          </div>

          <!-- Card Action Buttons -->
          <div class="flex items-center gap-1.5 self-end sm:self-auto">
            ${idea.status !== 'saved' ? `
              <button onclick="setDailyIdeaStatus('${idea.id}', 'saved')" class="px-3 py-1.5 bg-slate-800 hover:bg-emerald-950/80 hover:text-emerald-400 hover:border-emerald-800 text-slate-300 rounded-lg text-xs font-semibold border border-bg-border transition-colors flex items-center gap-1">
                <i data-lucide="heart" class="w-3.5 h-3.5"></i>
                <span>Сохранить</span>
              </button>
            ` : `
              <span class="px-3 py-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 rounded-lg text-xs font-semibold flex items-center gap-1">
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>В сохраненных</span>
              </span>
            `}

            ${idea.status !== 'dismissed' ? `
              <button onclick="setDailyIdeaStatus('${idea.id}', 'dismissed')" class="p-1.5 bg-slate-800 hover:bg-rose-950/80 hover:text-rose-400 hover:border-rose-800 text-slate-400 rounded-lg text-xs border border-bg-border transition-colors" title="Отклонить идею">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            ` : `
              <button onclick="setDailyIdeaStatus('${idea.id}', 'new')" class="px-2.5 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium" title="Вернуть в ленту">
                Восстановить
              </button>
            `}
          </div>
        </div>

        <!-- Main Title -->
        <h3 class="text-base font-bold text-white leading-snug">${idea.title}</h3>

        <!-- Rationale & details -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          <div class="md:col-span-6 p-3 rounded-lg bg-bg-input border border-bg-border space-y-1">
            <div class="text-[10px] font-semibold uppercase text-blue-400 flex items-center gap-1">
              <i data-lucide="trending-up" class="w-3 h-3"></i>
              <span>Почему идея сработает:</span>
            </div>
            <p class="text-xs text-slate-300">${idea.reason}</p>
          </div>

          <div class="md:col-span-6 p-3 rounded-lg bg-bg-input border border-bg-border space-y-1">
            <div class="text-[10px] font-semibold uppercase text-amber-400 flex items-center gap-1">
              <i data-lucide="zap" class="w-3 h-3"></i>
              <span>Хук первых 5 секунд:</span>
            </div>
            <p class="text-xs text-slate-300 italic">«${idea.hook}»</p>
          </div>
        </div>

        <!-- Thumbnail concept & Bottom action -->
        <div class="p-3 rounded-lg bg-bg-input border border-bg-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-start gap-2 text-xs text-slate-400">
            <i data-lucide="image" class="w-4 h-4 text-purple-400 shrink-0 mt-0.5"></i>
            <div>
              <b class="text-slate-200">Идея для превью:</b> ${idea.thumbnail_idea}
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button onclick="copyToClipboard('${idea.title.replace(/'/g, "\\'")}', 'Заголовок скопирован!')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded transition-colors flex items-center gap-1">
              <i data-lucide="copy" class="w-3 h-3 text-blue-400"></i>
              <span>Копия</span>
            </button>
            <button onclick="prefillAITitle('${idea.title.replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1">
              <i data-lucide="sparkles" class="w-3 h-3"></i>
              <span>AI План видео</span>
            </button>
          </div>
        </div>

      </div>
    `;
  });

  container.innerHTML = `<div class="fade-in space-y-4">${cardsHtml}</div>`;
  if (window.lucide) lucide.createIcons();
}

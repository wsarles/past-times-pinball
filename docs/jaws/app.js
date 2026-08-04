const scoreList = document.querySelector('#scores');
const emptyState = document.querySelector('#empty-state');
const personalBest = document.querySelector('#personal-best');
const gamesTracked = document.querySelector('#games-tracked');
const lastUpdated = document.querySelector('#last-updated');
const refreshButton = document.querySelector('#refresh');

const formatScore = new Intl.NumberFormat('en-US');
const formatDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

async function loadScores() {
  refreshButton.disabled = true;

  try {
    const response = await fetch(`./scores.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load scores (${response.status})`);

    const data = await response.json();
    const scores = [...(data.scores ?? [])]
      .filter(({ score }) => Number.isFinite(Number(score)))
      .sort((a, b) => Number(b.score) - Number(a.score))
      .slice(0, 10);

    scoreList.replaceChildren(...scores.map(renderScore));
    emptyState.hidden = scores.length > 0;
    personalBest.textContent = scores.length ? formatScore.format(scores[0].score) : '—';
    gamesTracked.textContent = formatScore.format(data.totalGames ?? data.scores?.length ?? 0);
    lastUpdated.textContent = data.updatedAt ? formatDate.format(new Date(data.updatedAt)) : '—';
  } catch (error) {
    scoreList.replaceChildren();
    emptyState.hidden = false;
    emptyState.textContent = error.message;
    personalBest.textContent = '—';
    gamesTracked.textContent = '—';
    lastUpdated.textContent = '—';
  } finally {
    refreshButton.disabled = false;
  }
}

function renderScore(entry, index) {
  const item = document.createElement('li');
  item.className = 'score-row';

  const date = entry.playedAt ? formatDate.format(new Date(entry.playedAt)) : 'Date unknown';
  const details = [date, entry.location, entry.notes].filter(Boolean).join(' • ');

  item.innerHTML = `
    <span class="rank">${index + 1}</span>
    <div>
      <div class="score-value">${formatScore.format(entry.score)}</div>
      <div class="score-meta">${escapeHtml(details)}</div>
    </div>
    <span class="source">${escapeHtml(entry.source ?? 'manual')}</span>
  `;

  return item;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

refreshButton.addEventListener('click', loadScores);
loadScores();

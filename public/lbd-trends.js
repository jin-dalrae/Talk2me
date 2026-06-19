import { fetchLbdSessions, getCurrentIdToken, initAuthUi } from './firebase-client.js';
import { creditsLabel, fetchLbdCredits, lbdApiBase } from './lbd-credits.js';
import { buildTrendsInsights, scenarioDisplayName, styleMixBarWidth } from './lbd-frameworks.js';

const $ = (id) => document.getElementById(id);
const trendsEl = $('trends');

let signedIn = false;
const apiBase = lbdApiBase;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function tagClass(name) {
  return `lbd-tag lbd-${String(name || '').replace(/\W/g, '')}`;
}

function renderBars(rows, { compact = false } = {}) {
  if (!rows.length) {
    return '<p class="lbd-dim">No style data yet — complete a session and wrap up for your debrief.</p>';
  }
  return `<div class="lbd-bars${compact ? ' compact' : ''}">${rows
    .map((x) => {
      const pct = Number(x.pct) || 0;
      const width = styleMixBarWidth(pct);
      const zero = pct <= 0 ? ' is-zero' : '';
      return `<div class="lbd-bar${zero}"><span class="${tagClass(x.style)}">${esc(x.style)}</span><span class="lbd-bar-track"><span class="lbd-bar-fill" style="width:${width}%"></span></span><span class="lbd-bar-pct">${pct}%</span></div>`;
    })
    .join('')}</div>`;
}

function renderSparkline(sessions) {
  const points = sessions
    .slice()
    .reverse()
    .map((s) => {
      const mix = s.debrief?.styleMix || [];
      const neg = mix.find((r) => r.style === 'Negotiator')?.pct || 0;
      const fight = mix.find((r) => r.style === 'Fighter')?.pct || 0;
      return Math.max(0, Number(neg) - Number(fight));
    });
  if (points.length < 2) return '<p class="lbd-dim">Need 2+ sessions for a trend line.</p>';
  const w = 280;
  const h = 56;
  const min = Math.min(...points, -20);
  const max = Math.max(...points, 20);
  const range = max - min || 1;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });
  return `<svg class="lbd-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="2" points="${coords.join(' ')}"/></svg><p class="lbd-spark-label">Negotiator − Fighter over sessions (higher = more collaborative)</p>`;
}

function renderPatternCards(rows, emptyMsg) {
  if (!rows.length) return `<p class="lbd-dim">${emptyMsg}</p>`;
  return `<div class="lbd-pattern-grid">${rows
    .map(
      (p) => `<article class="lbd-pattern-card">
        <span class="lbd-pattern-count">${p.count}×</span>
        <p>${esc(p.text)}</p>
      </article>`,
    )
    .join('')}</div>`;
}

function renderQuoteCards(moments) {
  if (!moments.length) {
    return '<p class="lbd-dim">No quoted moments yet — wrap up a session and we will pull lines from your transcript.</p>';
  }
  return `<div class="lbd-quote-grid">${moments
    .map(
      (m) => `<blockquote class="lbd-quote-card">
        <p class="lbd-quote-text">"${esc(m.quote)}"</p>
        <footer>
          ${m.framework ? `<span class="${tagClass(m.framework)}">${esc(m.framework)}</span>` : ''}
          <span class="lbd-quote-meta">${esc(m.scenarioTitle)} · ${fmtDate(m.date)}</span>
          ${m.note ? `<p class="lbd-quote-note">${esc(m.note)}</p>` : ''}
        </footer>
      </blockquote>`,
    )
    .join('')}</div>`;
}

function renderBetterMoves(moves) {
  if (!moves.length) {
    return '<p class="lbd-dim">Alternatives appear after debriefs suggest different approaches for your scenarios.</p>';
  }
  return `<div class="lbd-move-grid">${moves
    .map(
      (m) => `<article class="lbd-move-card">
        <span class="${tagClass(m.style)}">${esc(m.style)}</span>
        <p class="lbd-move-example">"${esc(m.example)}"</p>
        ${m.why ? `<p class="lbd-move-why">${esc(m.why)}</p>` : ''}
        ${m.count > 1 ? `<span class="lbd-pattern-count">${m.count} sessions</span>` : ''}
      </article>`,
    )
    .join('')}</div>`;
}

function renderSessionRow(s) {
  const d = s.debrief || {};
  const top = (d.styleMix || [])[0];
  const watch = (d.watchouts || [])[0];
  return `<article class="lbd-trend-row">
    <div class="lbd-trend-meta">
      <strong>${esc(scenarioDisplayName(s.scenarioId, s.scenarioTitle))}</strong>
      <span>${fmtDate(s.createdAt)} · ${s.exchangeCount || '?'} turns · ${s.variant === 'coach' ? 'coach mode' : `${s.parties || 1}:1`}</span>
    </div>
    <p class="lbd-trend-headline">${esc(d.headline || '—')}</p>
    <p class="lbd-dim">${d.outcome ? `Outcome: ${esc(d.outcome)}` : ''}${watch ? ` · Watch-out: ${esc(watch)}` : ''}</p>
    ${top ? `<span class="${tagClass(top.style)}">${esc(top.style)} ${top.pct}%</span>` : ''}
  </article>`;
}

function renderDashboard(sessions) {
  const insights = buildTrendsInsights(sessions);
  const recent = sessions.slice(0, 10);

  if (!sessions.length) {
    trendsEl.innerHTML = `
      <div class="lbd-trends-top">
        <a class="lbd-back" href="/lbd">← Simulator</a>
        <h1 class="lbd-h1">Your speaking trends</h1>
        <p class="lbd-hint">No sessions recorded yet. Run a scenario, tap <strong>Wrap up</strong> when you are done, and your debrief feeds this dashboard — including quotes from what you said.</p>
        <p class="lbd-foot"><a class="lbd-link" href="/lbd">Go to simulator →</a></p>
      </div>`;
    return;
  }

  const speakerLabel = insights.primaryStyle
    ? `${insights.primaryStyle}${insights.secondaryStyle ? ` + ${insights.secondaryStyle}` : ''}`
    : 'Building your profile';

  trendsEl.innerHTML = `
    <div class="lbd-trends-top">
      <a class="lbd-back" href="/lbd">← Simulator</a>
      <h1 class="lbd-h1">Your speaking trends</h1>
      <p class="lbd-sub">${insights.totalConversations} conversation${insights.totalConversations === 1 ? '' : 's'} · ${insights.totalTurns} turns spoken · ${insights.scenariosPlayed} scenario${insights.scenariosPlayed === 1 ? '' : 's'} practiced</p>
    </div>

    <div class="lbd-trends-hero">
      <section class="lbd-panel lbd-hero-stat">
        <p class="lbd-h3">Conversations</p>
        <p class="lbd-stat">${insights.totalConversations}</p>
        <p class="lbd-dim">${insights.debriefedCount} with full debrief</p>
      </section>
      <section class="lbd-panel lbd-hero-stat">
        <p class="lbd-h3">Avg pace</p>
        <p class="lbd-stat">${insights.avgTurns ?? '—'}</p>
        <p class="lbd-dim">turns before wrap-up</p>
      </section>
      <section class="lbd-panel lbd-hero-stat">
        <p class="lbd-h3">Speaker type</p>
        <p class="lbd-stat lbd-stat-label">${esc(speakerLabel)}</p>
        ${insights.speakerTagline ? `<p class="lbd-dim">${esc(insights.speakerTagline)}</p>` : ''}
      </section>
    </div>

    ${insights.profileSummary ? `<section class="lbd-panel lbd-trends-section lbd-profile-card">
      <h2 class="lbd-h3">Your speaker profile</h2>
      <p class="lbd-profile-summary">${esc(insights.profileSummary)}</p>
      ${insights.whenItWorks ? `<p class="lbd-profile-detail"><strong>Works when:</strong> ${esc(insights.whenItWorks)}</p>` : ''}
      ${insights.whenItFails ? `<p class="lbd-profile-detail"><strong>Watch when:</strong> ${esc(insights.whenItFails)}</p>` : ''}
      <div class="lbd-profile-mix">
        <p class="lbd-h3">Average style mix</p>
        ${renderBars(insights.avgStyleMix)}
      </div>
    </section>` : ''}

    <div class="lbd-trends-grid">
      <section class="lbd-panel">
        <h2 class="lbd-h3">Collaboration trend</h2>
        ${renderSparkline(sessions)}
      </section>
      <section class="lbd-panel">
        <h2 class="lbd-h3">Outcomes</h2>
        <ul class="lbd-outcomes">${insights.outcomes.map(([k, v]) => `<li><span>${esc(k)}</span><strong>${v}</strong></li>`).join('') || '<li class="lbd-dim">—</li>'}</ul>
      </section>
    </div>

    <section class="lbd-panel lbd-trends-section">
      <h2 class="lbd-h3">Logic & persuasion patterns you keep falling into</h2>
      <p class="lbd-dim">Recurring watch-outs from your debriefs — the rhetorical habits and traps that show up across sessions.</p>
      ${renderPatternCards(insights.watchoutPatterns, 'No recurring patterns yet — complete more wrap-ups to see what keeps showing up.')}
      ${insights.reasoningSnippets.length ? `<div class="lbd-reasoning-block"><p class="lbd-h3">How you tend to reason</p><ul class="lbd-recap">${insights.reasoningSnippets.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
    </section>

    <section class="lbd-panel lbd-trends-section">
      <h2 class="lbd-h3">Your words</h2>
      <p class="lbd-dim">Direct quotes from your simulations — mapped to conflict styles and feedback frameworks.</p>
      ${renderQuoteCards(insights.quoteMoments)}
    </section>

    <section class="lbd-panel lbd-trends-section">
      <h2 class="lbd-h3">Better ways to go</h2>
      <p class="lbd-dim">Alternative lines debriefs suggested — aggregated across your sessions.</p>
      ${renderBetterMoves(insights.betterMoves)}
    </section>

    ${insights.strengthPatterns.length ? `<section class="lbd-panel lbd-trends-section">
      <h2 class="lbd-h3">What is working</h2>
      ${renderPatternCards(insights.strengthPatterns, '')}
    </section>` : ''}

    <section class="lbd-panel lbd-trend-history">
      <h2 class="lbd-h3">Session history</h2>
      <div class="lbd-trend-list">${recent.map(renderSessionRow).join('')}</div>
    </section>

    <p class="lbd-foot"><a class="lbd-link" href="/lbd">Run another scenario →</a></p>`;
}

function renderEmpty(msg) {
  trendsEl.innerHTML = `
    <div class="lbd-trends-top">
      <a class="lbd-back" href="/lbd">← Simulator</a>
      <h1 class="lbd-h1">Your speaking trends</h1>
      <p class="lbd-hint">${msg}</p>
      <p class="lbd-foot"><a class="lbd-link" href="/lbd">Go to simulator →</a></p>
    </div>`;
}

async function loadTrendsFromRelay() {
  const token = await getCurrentIdToken(true);
  if (!token) return null;
  const res = await fetch(`${apiBase()}/api/lbd/trends`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const { sessions } = await res.json();
  return sessions || [];
}

async function loadTrends() {
  if (!signedIn) {
    renderEmpty('Sign in (top right) to see your speaking trends — conversation count, speaker type, persuasion patterns, and quotes from what you said.');
    return;
  }
  trendsEl.innerHTML = '<p class="lbd-dim">Loading trends…</p>';
  try {
    let sessions = await fetchLbdSessions();
    if (!sessions.length) {
      const relaySessions = await loadTrendsFromRelay();
      if (relaySessions?.length) sessions = relaySessions;
    }
    renderDashboard(sessions);
  } catch {
    try {
      const relaySessions = await loadTrendsFromRelay();
      if (relaySessions) {
        renderDashboard(relaySessions);
        return;
      }
    } catch { /* fall through */ }
    renderEmpty('Could not load trends. Check your connection and try again.');
  }
}

async function refreshCredits() {
  const el = $('lbd-credits');
  if (!signedIn) {
    if (el) el.hidden = true;
    return;
  }
  const credits = await fetchLbdCredits(getCurrentIdToken);
  if (!el || !credits) return;
  el.hidden = false;
  el.textContent = creditsLabel(credits);
  el.classList.toggle('is-empty', credits.remaining <= 0);
}

initAuthUi();
window.addEventListener('talk2me:auth-changed', (e) => {
  signedIn = Boolean(e.detail?.signedIn);
  refreshCredits();
  loadTrends();
});
refreshCredits();
loadTrends();
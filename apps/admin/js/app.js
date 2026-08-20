(function () {
  const TOKEN_KEY = 'infiny.admin.token';
  const API_KEY = 'infiny.admin.apiBase';
  const EMAIL_KEY = 'infiny.admin.email';

  const ICONS = {
    dashboard:
      '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
    users:
      '<circle cx="9" cy="8" r="3"/><path d="M4 19c.4-3.2 2.8-5 5-5s4.6 1.8 5 5"/><path d="M16 11a2.5 2.5 0 1 0-.2-4.9"/><path d="M19.5 19c0-2.1-1.4-3.8-3.3-4.4"/>',
    subscriptions:
      '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 10h16"/><path d="M8 15h3"/>',
    payments:
      '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14.5" r="1.4"/>',
    devices:
      '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M10 19h4"/>',
    sources:
      '<polygon points="8,5 19,12 8,19"/>',
    analytics:
      '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 14l4-5 3 3 5-7"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.9 6.3l1.5 1.5M17.6 16.2l1.5 1.5M3 12h2M19 12h2M4.9 17.7l1.5-1.5M17.6 7.8l1.5-1.5"/>',
  };

  const PAGES = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users', label: 'Utilisateurs' },
    { id: 'subscriptions', label: 'Abonnements' },
    { id: 'payments', label: 'Paiements' },
    { id: 'devices', label: 'Appareils' },
    { id: 'sources', label: 'Sources IPTV' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings', label: 'Paramètres' },
  ];

  const PAGE_TITLES = {
    dashboard: 'Tableau de bord',
    users: 'Utilisateurs',
    subscriptions: 'Abonnements',
    payments: 'Paiements',
    devices: 'Appareils',
    sources: 'Sources IPTV',
    analytics: 'Analytics',
    settings: 'Paramètres',
  };

  const PERIODS = [
    { key: '7d', label: '7 j' },
    { key: '30d', label: '30 j' },
    { key: '90d', label: '90 j' },
    { key: '1y', label: '1 an' },
  ];

  const ACTIVITY_LABELS = {
    user_registered: 'Inscription',
    payment_succeeded: 'Paiement réussi',
    payment_failed: 'Paiement échoué',
    premium_started: 'Premium',
    playlist_added: 'Playlist ajoutée',
  };

  const PLATFORM_LABELS = {
    android_tv: 'Android TV',
    android: 'Android',
    ios: 'iOS',
    web: 'Web',
  };

  const CHART_COLORS = {
    total: '#3d7eff',
    neu: '#4ec4ff',
    premium: '#8aa4ff',
    revenue: '#3d7eff',
  };

  const state = {
    apiBase: '',
    token: '',
    email: '',
    page: '',
    period: '30d',
  };

  function defaultApiBase() {
    if (location.protocol === 'file:' || location.origin === 'null' || !location.origin) {
      return 'http://localhost:3000';
    }
    return location.origin;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function icon(id) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id] || ''}</svg>`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function asList(value) {
    return Array.isArray(value) ? value : [];
  }

  function asPoints(value) {
    return Array.isArray(value) ? value : [];
  }

  function formatNumber(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return new Intl.NumberFormat('fr-FR').format(Number(n));
  }

  function formatMoney(n, currency) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(Number(n));
    } catch {
      return `${formatNumber(n)} ${currency || 'EUR'}`;
    }
  }

  function formatWhen(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }

  function formatTick(iso, unit) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    if (unit === 'month') return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d);
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
  }

  /** Null changePct → em dash, never a made-up %, never green/red. */
  function formatChangePct(pct) {
    if (pct === null || pct === undefined) return { text: '—', cls: 'flat' };
    const n = Number(pct);
    if (Number.isNaN(n)) return { text: '—', cls: 'flat' };
    const cls = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
    const text = `${new Intl.NumberFormat('fr-FR', {
      signDisplay: 'exceptZero',
      maximumFractionDigits: 1,
    }).format(n)} %`;
    return { text, cls };
  }

  function formatRate(rate) {
    if (rate === null || rate === undefined) return '—';
    const n = Number(rate);
    if (Number.isNaN(n)) return '—';
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)} %`;
  }

  function deltaHtml(pct) {
    const d = formatChangePct(pct);
    return `<span class="delta ${d.cls}">${escapeHtml(d.text)}</span>`;
  }

  async function api(path) {
    const res = await fetch(`${state.apiBase}${path}`, {
      headers: { Authorization: `Bearer ${state.token}`, Accept: 'application/json' },
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      const err = new Error(
        res.status === 403
          ? "Ce compte n'est pas administrateur."
          : 'Session expirée. Veuillez vous reconnecter.'
      );
      err.status = res.status;
      throw err;
    }
    if (!res.ok) {
      const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
      throw new Error(message || `Erreur ${res.status}`);
    }
    return body;
  }

  function logout() {
    state.token = '';
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    $('app-shell').classList.add('hidden');
    $('login-view').classList.remove('hidden');
    $('password').value = '';
  }

  function closeMobileNav() {
    $('sidebar').classList.remove('open');
    $('backdrop').classList.remove('show');
  }

  function emptyPage(title, message) {
    return `
      <div class="card empty-page">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  function handleAuthError(err) {
    if (err.status === 401 || err.status === 403) {
      logout();
      $('login-error').textContent = err.message;
      $('login-error').classList.remove('hidden');
      return true;
    }
    return false;
  }

  function lineChart(series, unit) {
    const longest = series.reduce((a, b) => (a.points.length >= b.points.length ? a : b), series[0] || { points: [] });
    const n = longest.points.length;
    if (!n) return '<p class="empty">Aucune série pour cette période.</p>';

    const w = 720;
    const h = 240;
    const pad = { l: 40, r: 12, t: 16, b: 32 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const all = series.flatMap((s) => s.points);
    const max = Math.max(0, ...all.map((p) => Number(p.v) || 0));
    const yMax = max === 0 ? 1 : max;
    const xAt = (i) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v) => pad.t + innerH - (v / yMax) * innerH;

    const grid = [0, 0.5, 1]
      .map((f) => {
        const y = pad.t + innerH * (1 - f);
        return `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="rgba(255,255,255,0.06)" />`;
      })
      .join('');

    const paths = series
      .map((s) => {
        const d = s.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yAt(Number(p.v) || 0).toFixed(1)}`)
          .join(' ');
        return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`;
      })
      .join('');

    const tickIdx = [0, Math.round((n - 1) / 2), n - 1].filter(
      (i, idx, arr) => i >= 0 && i < n && arr.indexOf(i) === idx
    );
    const labels = tickIdx
      .map((i) => {
        const x = xAt(i);
        return `<text x="${x}" y="${h - 10}" fill="#5c6472" font-size="11" text-anchor="middle">${escapeHtml(
          formatTick(longest.points[i].t, unit)
        )}</text>`;
      })
      .join('');

    const yLabel = `<text x="8" y="${pad.t + 4}" fill="#5c6472" font-size="11">${escapeHtml(formatNumber(max))}</text>`;

    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${grid}${paths}${labels}${yLabel}</svg>`;
  }

  function donutChart(slices) {
    const total = slices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    const r = 64;
    const c = 90;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    const rings =
      total === 0
        ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="16" />`
        : slices
            .map((s) => {
              const value = Number(s.value) || 0;
              const len = (value / total) * circ;
              const dash = `${len} ${circ - len}`;
              const el = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${c} ${c})" />`;
              offset += len;
              return el;
            })
            .join('');

    const legend = slices
      .map(
        (s) =>
          `<div><span class="swatch" style="background:${s.color}"></span>${escapeHtml(s.label)} · ${formatNumber(
            s.value
          )}</div>`
      )
      .join('');

    return `
      <div class="donut-wrap">
        <svg class="donut" viewBox="0 0 180 180">${rings}</svg>
        <div class="donut-legend">${legend}</div>
      </div>
    `;
  }

  async function renderDashboard() {
    const root = $('page');
    root.innerHTML = '<p class="muted">Chargement…</p>';
    try {
      const [kpis, series, activity, payments, devices] = await Promise.all([
        api(`/admin/dashboard?period=${encodeURIComponent(state.period)}`),
        api(`/admin/series?period=${encodeURIComponent(state.period)}`),
        api('/admin/activity?limit=12'),
        api('/admin/payments?limit=8'),
        api('/admin/devices?limit=8'),
      ]);

      const unit = series.period?.unit || 'day';
      const usersPts = asPoints(series.users?.total);
      const newPts = asPoints(series.users?.new);
      const premiumPts = asPoints(series.users?.premium);
      const revenuePts = asPoints(series.revenue?.points);
      const activityRows = asList(activity);
      const paymentRows = asList(payments);
      const deviceRows = asList(devices);

      root.innerHTML = `
        <section class="kpis">
          <article class="card">
            <p class="kpi-label">Utilisateurs</p>
            <p class="kpi-value">${formatNumber(kpis.users?.totalAllTime)}</p>
            <p class="kpi-sub">${formatNumber(kpis.users?.value)} nouveaux · ${deltaHtml(kpis.users?.changePct)}</p>
          </article>
          <article class="card">
            <p class="kpi-label">Revenus</p>
            <p class="kpi-value">${formatMoney(kpis.revenue?.value, kpis.revenue?.currency)}</p>
            <p class="kpi-sub">vs période préc. · ${deltaHtml(kpis.revenue?.changePct)}</p>
          </article>
          <article class="card">
            <p class="kpi-label">Conversion</p>
            <p class="kpi-value">${escapeHtml(formatRate(kpis.conversion?.rate))}</p>
            <p class="kpi-sub">Essais terminés → Premium</p>
          </article>
          <article class="card">
            <p class="kpi-label">Premium actifs</p>
            <p class="kpi-value">${formatNumber(kpis.premium?.active)}</p>
            <p class="kpi-sub">${formatNumber(kpis.premium?.expiringSoon)} expirent sous 7 j</p>
          </article>
        </section>

        <section class="charts wide">
          <article class="card">
            <div class="chart-head">
              <h2>Évolution des utilisateurs</h2>
              <div class="periods" id="period-switch">
                ${PERIODS.map(
                  (p) =>
                    `<button type="button" data-period="${p.key}" class="${p.key === state.period ? 'active' : ''}">${p.label}</button>`
                ).join('')}
              </div>
            </div>
            ${lineChart(
              [
                { color: CHART_COLORS.total, points: usersPts },
                { color: CHART_COLORS.neu, points: newPts },
                { color: CHART_COLORS.premium, points: premiumPts },
              ],
              unit
            )}
            <div class="legend">
              <span><span class="swatch" style="background:${CHART_COLORS.total}"></span>Total</span>
              <span><span class="swatch" style="background:${CHART_COLORS.neu}"></span>Nouveaux</span>
              <span><span class="swatch" style="background:${CHART_COLORS.premium}"></span>Premium</span>
            </div>
          </article>
        </section>

        <section class="charts split">
          <article class="card">
            <div class="chart-head"><h2>Revenus</h2></div>
            ${lineChart([{ color: CHART_COLORS.revenue, points: revenuePts }], unit)}
            <p class="kpi-sub">${escapeHtml(series.revenue?.currency || kpis.revenue?.currency || 'EUR')}</p>
          </article>
          <article class="card">
            <div class="chart-head"><h2>État des abonnements</h2></div>
            ${donutChart([
              { label: 'Essais actifs', value: kpis.trials?.active, color: '#4ec4ff' },
              { label: 'Premium actifs', value: kpis.premium?.active, color: '#3d7eff' },
              { label: 'Essais expirés', value: kpis.trials?.expired, color: '#5c6472' },
            ])}
          </article>
        </section>

        <section class="panels">
          <article class="card panel">
            <h2>Activité récente</h2>
            ${
              activityRows.length
                ? activityRows
                    .map(
                      (item) => `
              <div class="row">
                <div>
                  <div>${escapeHtml(ACTIVITY_LABELS[item.kind] || item.kind)}</div>
                  <div class="meta">${escapeHtml(item.userLabel || '—')}${item.detail ? ' · ' + escapeHtml(item.detail) : ''}</div>
                </div>
                <div class="meta">${escapeHtml(formatWhen(item.at))}</div>
              </div>`
                    )
                    .join('')
                : '<p class="empty">Aucune activité pour le moment.</p>'
            }
          </article>
          <article class="card panel">
            <h2>Derniers paiements</h2>
            ${
              paymentRows.length
                ? paymentRows
                    .map(
                      (p) => `
              <div class="row">
                <div>
                  <div>${escapeHtml(formatMoney(p.amount, p.currency))}</div>
                  <div class="meta">${escapeHtml(p.userLabel || '—')} · ${escapeHtml(p.provider || '—')}</div>
                </div>
                <div class="badge ${p.status === 'success' ? 'ok' : p.status === 'failed' ? 'bad' : ''}">${escapeHtml(p.status || '—')}</div>
              </div>`
                    )
                    .join('')
                : '<p class="empty">Aucun paiement.</p>'
            }
          </article>
          <article class="card panel">
            <h2>Appareils actifs</h2>
            ${
              deviceRows.length
                ? deviceRows
                    .map(
                      (d) => `
              <div class="row">
                <div>
                  <div>${escapeHtml(d.deviceName || '—')}</div>
                  <div class="meta">${escapeHtml(PLATFORM_LABELS[d.platform] || d.platform || '—')} · ${escapeHtml(d.userLabel || '—')}</div>
                </div>
                <div class="meta">${escapeHtml(formatWhen(d.lastActive))}</div>
              </div>`
                    )
                    .join('')
                : '<p class="empty">Aucun appareil actif.</p>'
            }
          </article>
        </section>
      `;

      $('period-switch').addEventListener('click', (event) => {
        const btn = event.target.closest('[data-period]');
        if (!btn) return;
        const next = btn.getAttribute('data-period');
        if (next === state.period) return;
        state.period = next;
        renderDashboard();
      });
    } catch (err) {
      if (handleAuthError(err)) return;
      root.innerHTML = `<div class="card"><p class="error">${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function renderPaymentsPage() {
    const root = $('page');
    root.innerHTML = '<p class="muted">Chargement…</p>';
    try {
      const rows = asList(await api('/admin/payments?limit=50'));
      if (!rows.length) {
        root.innerHTML = emptyPage('Paiements', 'Aucun paiement enregistré pour le moment.');
        return;
      }
      root.innerHTML = `
        <article class="card table-wrap">
          <table class="table">
            <thead><tr><th>Date</th><th>Utilisateur</th><th>Montant</th><th>Fournisseur</th><th>Statut</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (p) => `<tr>
                    <td>${escapeHtml(formatWhen(p.at))}</td>
                    <td>${escapeHtml(p.userLabel || '—')}</td>
                    <td>${escapeHtml(formatMoney(p.amount, p.currency))}</td>
                    <td>${escapeHtml(p.provider || '—')}</td>
                    <td><span class="badge ${p.status === 'success' ? 'ok' : p.status === 'failed' ? 'bad' : ''}">${escapeHtml(p.status || '—')}</span></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </article>
      `;
    } catch (err) {
      if (handleAuthError(err)) return;
      root.innerHTML = `<div class="card"><p class="error">${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function renderDevicesPage() {
    const root = $('page');
    root.innerHTML = '<p class="muted">Chargement…</p>';
    try {
      const rows = asList(await api('/admin/devices?limit=50'));
      if (!rows.length) {
        root.innerHTML = emptyPage('Appareils', 'Aucun appareil actif.');
        return;
      }
      root.innerHTML = `
        <article class="card table-wrap">
          <table class="table">
            <thead><tr><th>Appareil</th><th>Plateforme</th><th>Utilisateur</th><th>Dernière activité</th><th>Statut</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (d) => `<tr>
                    <td>${escapeHtml(d.deviceName || '—')}</td>
                    <td>${escapeHtml(PLATFORM_LABELS[d.platform] || d.platform || '—')}</td>
                    <td>${escapeHtml(d.userLabel || '—')}</td>
                    <td>${escapeHtml(formatWhen(d.lastActive))}</td>
                    <td>${escapeHtml(d.status || '—')}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </article>
      `;
    } catch (err) {
      if (handleAuthError(err)) return;
      root.innerHTML = `<div class="card"><p class="error">${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderSettings() {
    $('page').innerHTML = `
      <article class="card" style="max-width:520px">
        <h2>Paramètres</h2>
        <p class="kpi-sub">L'édition du prix, de l'essai et de la limite d'appareils n'a pas encore d'API d'écriture.</p>
        <p class="kpi-label" style="margin-top:18px">URL du serveur</p>
        <p>${escapeHtml(state.apiBase)}</p>
        <p class="kpi-label" style="margin-top:14px">Compte</p>
        <p>${escapeHtml(state.email || '—')}</p>
      </article>
    `;
  }

  function renderPage() {
    if (state.page === 'dashboard') return renderDashboard();
    if (state.page === 'payments') return renderPaymentsPage();
    if (state.page === 'devices') return renderDevicesPage();
    if (state.page === 'settings') return renderSettings();
    const copy = {
      users: ['Utilisateurs', "La liste détaillée des utilisateurs n'est pas encore exposée par l'API."],
      subscriptions: ['Abonnements', "La gestion des abonnements n'est pas encore exposée par l'API."],
      sources: ['Sources IPTV', "L'inventaire des sources IPTV n'est pas encore exposé par l'API."],
      analytics: ['Analytics', 'Les rapports analytics avancés restent à construire côté API.'],
    }[state.page];
    $('page').innerHTML = copy ? emptyPage(copy[0], copy[1]) : emptyPage('Page', 'Contenu indisponible.');
  }

  function setPage(id) {
    const next = PAGES.some((p) => p.id === id) ? id : 'dashboard';
    state.page = next;
    if (location.hash.replace(/^#\/?/, '') !== next) {
      location.hash = next;
    }
    document.querySelectorAll('.nav [data-page]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-page') === next);
    });
    $('page-title').textContent = PAGE_TITLES[next] || 'Administration';
    closeMobileNav();
    renderPage();
  }

  async function login() {
    const errorBox = $('login-error');
    const btn = $('login-btn');
    errorBox.classList.add('hidden');
    const apiBase = $('api-base').value.replace(/\/+$/, '');
    const email = $('email').value.trim();
    const password = $('password').value;
    if (!apiBase || !email || !password) {
      errorBox.textContent = 'Renseignez le serveur, l’email et le mot de passe.';
      errorBox.classList.remove('hidden');
      return;
    }
    btn.disabled = true;
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Connexion refusée.');
      state.apiBase = apiBase;
      state.token = body.accessToken;
      state.email = email;
      await api(`/admin/dashboard?period=${encodeURIComponent(state.period)}`);
      sessionStorage.setItem(TOKEN_KEY, state.token);
      sessionStorage.setItem(API_KEY, state.apiBase);
      sessionStorage.setItem(EMAIL_KEY, email);
      showApp();
      state.page = '';
      setPage(location.hash.replace(/^#\/?/, '') || 'dashboard');
    } catch (err) {
      state.token = '';
      errorBox.textContent = err.message || 'Connexion refusée. Vérifiez que ce compte est administrateur.';
      errorBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  }

  function showApp() {
    $('login-view').classList.add('hidden');
    $('app-shell').classList.remove('hidden');
    $('profile-email').textContent = state.email || 'Admin';
    $('profile-initial').textContent = (state.email || 'A').slice(0, 1).toUpperCase();
  }

  function restoreSession() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const apiBase = sessionStorage.getItem(API_KEY);
    if (!token || !apiBase) return false;
    state.token = token;
    state.apiBase = apiBase;
    state.email = sessionStorage.getItem(EMAIL_KEY) || '';
    return true;
  }

  function initNav() {
    $('nav-links').innerHTML = PAGES.map(
      (p) =>
        `<button type="button" data-page="${p.id}"><span class="ico">${icon(p.id)}</span><span class="label">${p.label}</span></button>`
    ).join('');
    $('nav-links').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-page]');
      if (btn) setPage(btn.getAttribute('data-page'));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('api-base').value = defaultApiBase();
    initNav();
    $('login-btn').addEventListener('click', login);
    $('password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') login();
    });
    $('email').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') login();
    });
    $('logout-btn').addEventListener('click', logout);
    $('menu-btn').addEventListener('click', () => {
      $('sidebar').classList.toggle('open');
      $('backdrop').classList.toggle('show');
    });
    $('backdrop').addEventListener('click', closeMobileNav);
    window.addEventListener('hashchange', () => {
      const id = location.hash.replace(/^#\/?/, '') || 'dashboard';
      if (!PAGES.some((p) => p.id === id) || id === state.page) return;
      setPage(id);
    });

    if (restoreSession()) {
      showApp();
      setPage(location.hash.replace(/^#\/?/, '') || 'dashboard');
    }
  });
})();

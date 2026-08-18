import { api, ApiError } from './api.js';
import { clearSession, getEmail, getToken, isSignedIn, saveSession } from './auth.js';

const PLATFORM_LABELS = {
  android_tv: 'Téléviseur Android',
  android: 'Android',
  ios: 'iOS',
  web: 'Web',
};

function $(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pathOf(url = location) {
  return url.pathname.replace(/\/$/, '') || '/';
}

function queryParam(name) {
  return new URLSearchParams(location.search).get(name) ?? '';
}

function navigate(to) {
  if (to === location.pathname + location.search) {
    render();
    return;
  }
  history.pushState({}, '', to);
  render();
}

function requireAuth(nextPath) {
  if (isSignedIn()) return true;
  const next = encodeURIComponent(nextPath || location.pathname + location.search);
  navigate(`/login?next=${next}`);
  return false;
}

function onUnauthorized() {
  clearSession();
  const next = encodeURIComponent(location.pathname + location.search);
  navigate(`/login?next=${next}`);
}

async function apiCall(path, options = {}) {
  try {
    return await api(path, { ...options, token: getToken() });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !options.anonymous) {
      onUnauthorized();
    }
    throw err;
  }
}

function pairingMessage(err) {
  if (!(err instanceof ApiError)) return 'Impossible de continuer pour le moment.';
  if (err.status === 410 || (err.status === 404 && /expir/i.test(err.message))) {
    return 'Ce code a expiré. Relancez l’appairage depuis le téléviseur.';
  }
  if (err.status === 404) return 'Code inconnu. Vérifiez le code affiché sur la TV.';
  if (err.status === 403) return 'Limite d’appareils atteinte. Révoquez un appareil pour en ajouter un nouveau.';
  return err.message;
}

function layout(active, inner) {
  const signedIn = isSignedIn();
  return `
    <div class="wrap">
      <header class="topbar">
        <a class="brand" href="/" data-link>
          <span class="brand-mark" aria-hidden="true"></span>
          Infiny Stream
        </a>
        <nav class="nav">
          <a href="/pair" data-link class="${active === 'pair' ? 'active' : ''}">Appairer</a>
          ${signedIn ? `
            <a href="/playlists" data-link class="${active === 'playlists' ? 'active' : ''}">Playlists</a>
            <a href="/devices" data-link class="${active === 'devices' ? 'active' : ''}">Appareils</a>
            <a href="/account" data-link class="${active === 'account' ? 'active' : ''}">Compte</a>
            <button class="linkish" type="button" data-logout>Quitter</button>
          ` : `
            <a href="/login" data-link class="${active === 'login' ? 'active' : ''}">Connexion</a>
          `}
        </nav>
      </header>
      ${inner}
    </div>
  `;
}

function renderHome() {
  if (isSignedIn()) {
    return layout('home', `
      <p class="kicker">Tableau de bord</p>
      <h1 class="page-title">Bonjour</h1>
      <p class="lede">Gérez vos playlists au clavier, puis appairer le téléviseur en un code.</p>
      <div class="grid two" style="margin-top:20px">
        <a class="card" href="/pair" data-link>
          <p class="kicker">TV</p>
          <strong>Appairer un téléviseur</strong>
          <p class="meta">Saisissez le code affiché à l’écran.</p>
        </a>
        <a class="card" href="/playlists" data-link>
          <p class="kicker">Sources</p>
          <strong>Playlists</strong>
          <p class="meta">Collez une URL M3U ou un compte Xtream.</p>
        </a>
      </div>
    `);
  }

  return layout('home', `
    <section class="hero">
      <p class="kicker">Infiny Stream</p>
      <h1>Votre univers de divertissement <span class="accent">en un seul endroit</span></h1>
      <p class="lede">Appairez la TV depuis le téléphone, puis collez vos playlists au clavier — plus besoin de la télécommande.</p>
    </section>
    <div class="grid two" style="margin-top:24px">
      <div class="card stack">
        <strong>J’ai un code TV</strong>
        <p class="meta">Scannez le QR ou saisissez le code à six caractères.</p>
        <a class="btn" href="/pair" data-link>Appairer un téléviseur</a>
      </div>
      <div class="card stack">
        <strong>Créer un compte</strong>
        <p class="meta">L’essai démarre tout de suite, sans étape supplémentaire.</p>
        <a class="btn secondary" href="/register" data-link>Créer un compte</a>
      </div>
    </div>
  `);
}

function renderAuth(mode) {
  const next = queryParam('next') || '/';
  const isRegister = mode === 'register';
  return layout(mode, `
    <div class="card stack" style="max-width:420px;margin:24px auto">
      <div>
        <p class="kicker">${isRegister ? 'Inscription' : 'Connexion'}</p>
        <h1 class="page-title" style="font-size:28px">${isRegister ? 'Créer un compte' : 'Se connecter'}</h1>
      </div>
      <form id="auth-form" class="stack" data-mode="${mode}" data-next="${escapeHtml(next)}">
        ${isRegister ? `<div><label for="name">Nom (optionnel)</label><input id="name" name="name" autocomplete="name" /></div>` : ''}
        <div>
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required autocomplete="email" />
        </div>
        <div>
          <label for="password">Mot de passe</label>
          <input id="password" name="password" type="password" required minlength="8" autocomplete="${isRegister ? 'new-password' : 'current-password'}" />
        </div>
        <div id="auth-error" hidden class="alert error"></div>
        <button class="btn" type="submit">${isRegister ? 'Créer le compte' : 'Se connecter'}</button>
      </form>
      <p class="meta">
        ${isRegister
          ? `Déjà un compte ? <a href="/login?next=${encodeURIComponent(next)}" data-link>Connexion</a>`
          : `Pas encore de compte ? <a href="/register?next=${encodeURIComponent(next)}" data-link>Inscription</a>`}
      </p>
    </div>
  `);
}

function renderPair() {
  const prefill = queryParam('code');
  return layout('pair', `
    <p class="kicker">Appairage TV</p>
    <h1 class="page-title">Connecter un téléviseur</h1>
    <p class="lede">Saisissez le code affiché sur la TV. Minuscules et tirets sont acceptés.</p>
    <form id="pair-lookup" class="card stack" style="margin-top:20px">
      <div>
        <label for="code">Code</label>
        <input id="code" name="code" class="code-input" maxlength="14" autocapitalize="characters" autocomplete="one-time-code" value="${escapeHtml(prefill)}" placeholder="ABC123" />
      </div>
      <div id="pair-error" hidden class="alert error"></div>
      <button class="btn" type="submit">Vérifier l’appareil</button>
    </form>
    <div id="pair-confirm" hidden></div>
  `);
}

function devicePreview(info) {
  const platform = PLATFORM_LABELS[info.platform] ?? info.platform;
  return `
    <div class="card stack" style="margin-top:16px">
      <div class="device-preview">
        <p class="kicker">Cet appareil demande l’accès</p>
        <h2>${escapeHtml(info.deviceName)}</h2>
        <p class="meta">${escapeHtml(platform)} · code ${escapeHtml(info.code)}</p>
      </div>
      <p class="meta">Vérifiez que c’est bien votre téléviseur avant d’autoriser. Ne validez pas un code que vous n’avez pas vous-même demandé.</p>
      <div class="confirm-actions">
        <button class="btn danger" type="button" data-deny>Refuser</button>
        <button class="btn" type="button" data-approve>Autoriser</button>
      </div>
      <div id="pair-action-error" hidden class="alert error"></div>
    </div>
  `;
}

function renderPlaylists() {
  return layout('playlists', `
    <p class="kicker">Sources</p>
    <h1 class="page-title">Playlists</h1>
    <p class="lede">Collez une URL M3U ici, au clavier. Le mot de passe Xtream n’est jamais réaffiché une fois enregistré.</p>
    <div class="card stack" style="margin-top:20px">
      <div class="tabs">
        <button type="button" class="active" data-tab="m3u">URL M3U</button>
        <button type="button" data-tab="xtream">Xtream</button>
      </div>
      <form id="playlist-form" class="stack">
        <input type="hidden" name="kind" value="m3u" />
        <div>
          <label for="pl-name">Nom</label>
          <input id="pl-name" name="name" required placeholder="Ma TV" />
        </div>
        <div data-m3u>
          <label for="pl-url">URL de la playlist</label>
          <input id="pl-url" name="url" placeholder="http://…/playlist.m3u" />
        </div>
        <div data-xtream hidden class="stack">
          <div>
            <label for="pl-server">URL du serveur</label>
            <input id="pl-server" name="serverUrl" placeholder="http://serveur.exemple.com:8080" />
          </div>
          <div>
            <label for="pl-user">Nom d’utilisateur</label>
            <input id="pl-user" name="username" autocomplete="off" />
          </div>
          <div>
            <label for="pl-pass">Mot de passe</label>
            <input id="pl-pass" name="password" type="password" autocomplete="new-password" />
          </div>
        </div>
        <div id="pl-error" hidden class="alert error"></div>
        <button class="btn" type="submit">Ajouter</button>
      </form>
    </div>
    <div id="playlist-list" class="stack" style="margin-top:16px"></div>
  `);
}

function renderDevices() {
  return layout('devices', `
    <p class="kicker">Compte</p>
    <h1 class="page-title">Appareils</h1>
    <p class="lede">Révoquez un appareil pour libérer une place si la limite est atteinte.</p>
    <div id="device-list" class="stack" style="margin-top:20px"></div>
  `);
}

function renderAccount() {
  return layout('account', `
    <p class="kicker">Compte</p>
    <h1 class="page-title">Abonnement</h1>
    <div id="account-card" class="card stack" style="margin-top:20px">
      <p class="meta">Chargement…</p>
    </div>
  `);
}

function mount(html) {
  const root = document.getElementById('app');
  root.replaceChildren($(html));
  root.querySelectorAll('[data-link]').forEach((el) => {
    el.addEventListener('click', (event) => {
      const href = el.getAttribute('href');
      if (!href || href.startsWith('http')) return;
      event.preventDefault();
      navigate(href);
    });
  });
  root.querySelector('[data-logout]')?.addEventListener('click', () => {
    clearSession();
    navigate('/');
  });
}

async function afterAuth(next) {
  const target = next && next.startsWith('/') ? next : '/';
  navigate(target);
}

function bindAuth() {
  const form = document.getElementById('auth-form');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = document.getElementById('auth-error');
    errorBox.hidden = true;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    const payload = { email, password };
    if (form.dataset.mode === 'register') {
      const name = String(data.get('name') || '').trim();
      if (name) payload.name = name;
    }
    try {
      const path = form.dataset.mode === 'register' ? '/auth/register' : '/auth/login';
      const result = await apiCall(path, { method: 'POST', body: payload, anonymous: true });
      saveSession(result.accessToken, email);
      await afterAuth(form.dataset.next);
    } catch (err) {
      errorBox.hidden = false;
      errorBox.textContent = err instanceof ApiError ? err.message : 'Connexion impossible.';
    }
  });
}

async function lookupPairing(rawCode) {
  const errorBox = document.getElementById('pair-error');
  const confirm = document.getElementById('pair-confirm');
  errorBox.hidden = true;
  confirm.hidden = true;
  try {
    const info = await apiCall(`/pairing/${encodeURIComponent(rawCode)}`);
    confirm.hidden = false;
    confirm.innerHTML = devicePreview(info);
    confirm.querySelector('[data-approve]').addEventListener('click', () => actOnPairing(rawCode, 'approve'));
    confirm.querySelector('[data-deny]').addEventListener('click', () => actOnPairing(rawCode, 'deny'));
  } catch (err) {
    errorBox.hidden = false;
    errorBox.textContent = pairingMessage(err);
  }
}

async function actOnPairing(rawCode, action) {
  const errorBox = document.getElementById('pair-action-error') ?? document.getElementById('pair-error');
  errorBox.hidden = true;
  try {
    await apiCall(`/pairing/${encodeURIComponent(rawCode)}/${action}`, { method: 'POST' });
    const confirm = document.getElementById('pair-confirm');
    confirm.hidden = false;
    confirm.innerHTML = `
      <div class="card stack">
        <div class="alert ok">${action === 'approve' ? 'Téléviseur autorisé. Il va se connecter tout seul.' : 'Demande refusée. Le téléviseur ne recevra pas l’accès.'}</div>
        <a class="btn secondary" href="/devices" data-link>Voir les appareils</a>
      </div>
    `;
    confirm.querySelector('[data-link]')?.addEventListener('click', (event) => {
      event.preventDefault();
      navigate('/devices');
    });
  } catch (err) {
    errorBox.hidden = false;
    errorBox.textContent = pairingMessage(err);
  }
}

function bindPair() {
  const form = document.getElementById('pair-lookup');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireAuth(location.pathname + location.search)) return;
    const code = String(new FormData(form).get('code') || '');
    await lookupPairing(code);
  });
  const prefill = queryParam('code');
  if (prefill && isSignedIn()) {
    lookupPairing(prefill);
  }
}

function playlistCard(item) {
  const details =
    item.type === 'xtream'
      ? `${item.username ?? ''} · ${item.serverUrl ?? ''}`
      : item.url ?? '';
  const typeLabel = item.type === 'xtream' ? 'Xtream' : item.type === 'm3u_url' ? 'M3U' : item.type;
  return `
    <div class="card list-card">
      <div>
        <p class="kicker">${escapeHtml(typeLabel)}</p>
        <strong>${escapeHtml(item.name)}</strong>
        <p class="meta">${escapeHtml(details)}</p>
      </div>
      <button class="btn danger" type="button" data-delete="${escapeHtml(item.id)}">Supprimer</button>
    </div>
  `;
}

async function refreshPlaylists() {
  const list = document.getElementById('playlist-list');
  if (!list) return;
  try {
    const items = await apiCall('/playlists');
    if (!items.length) {
      list.innerHTML = '<p class="empty">Aucune playlist pour le moment.</p>';
      return;
    }
    list.innerHTML = items.map(playlistCard).join('');
    list.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await apiCall(`/playlists/${btn.getAttribute('data-delete')}`, { method: 'DELETE' });
        await refreshPlaylists();
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
  }
}

function bindPlaylists() {
  const form = document.getElementById('playlist-form');
  if (!form) return;
  const tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      const kind = tab.getAttribute('data-tab');
      form.querySelector('[name="kind"]').value = kind;
      form.querySelector('[data-m3u]').hidden = kind !== 'm3u';
      form.querySelector('[data-xtream]').hidden = kind !== 'xtream';
    });
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = document.getElementById('pl-error');
    errorBox.hidden = true;
    const data = new FormData(form);
    const kind = String(data.get('kind'));
    const name = String(data.get('name') || '').trim();
    try {
      if (kind === 'xtream') {
        await apiCall('/playlists', {
          method: 'POST',
          body: {
            name,
            type: 'xtream',
            serverUrl: String(data.get('serverUrl') || '').trim(),
            username: String(data.get('username') || '').trim(),
            password: String(data.get('password') || ''),
          },
        });
        form.querySelector('[name="password"]').value = '';
      } else {
        await apiCall('/playlists', {
          method: 'POST',
          body: {
            name,
            type: 'm3u_url',
            url: String(data.get('url') || '').trim(),
          },
        });
      }
      form.reset();
      form.querySelector('[name="kind"]').value = kind;
      await refreshPlaylists();
    } catch (err) {
      errorBox.hidden = false;
      errorBox.textContent = err instanceof ApiError ? err.message : 'Impossible d’ajouter cette playlist.';
    }
  });
  refreshPlaylists();
}

async function refreshDevices() {
  const list = document.getElementById('device-list');
  if (!list) return;
  try {
    const items = await apiCall('/devices');
    if (!items.length) {
      list.innerHTML = '<p class="empty">Aucun appareil actif.</p>';
      return;
    }
    list.innerHTML = items
      .map((item) => `
        <div class="card list-card">
          <div>
            <p class="kicker">${escapeHtml(PLATFORM_LABELS[item.platform] ?? item.platform)}</p>
            <strong>${escapeHtml(item.deviceName)}</strong>
            <p class="meta">Dernière activité : ${escapeHtml(new Date(item.lastActive).toLocaleString('fr-FR'))}</p>
          </div>
          <button class="btn danger" type="button" data-revoke="${escapeHtml(item.id)}">Révoquer</button>
        </div>
      `)
      .join('');
    list.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await apiCall(`/devices/${btn.getAttribute('data-revoke')}`, { method: 'DELETE' });
        await refreshDevices();
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
  }
}

function daysRemaining(endDate) {
  const end = new Date(endDate).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

async function refreshAccount() {
  const card = document.getElementById('account-card');
  if (!card) return;
  card.innerHTML = `
    <p class="meta">${escapeHtml(getEmail() ?? '')}</p>
  `;
  try {
    const sub = await apiCall('/subscriptions/me');
    const days = daysRemaining(sub.endDate);
    const trial = sub.plan === 'trial';
    const expired = sub.status !== 'active' || new Date(sub.endDate).getTime() <= Date.now();
    card.innerHTML = `
      <p class="kicker">${trial ? 'Essai' : 'Premium'}</p>
      <strong>${expired ? 'Essai terminé' : trial ? `${days} jour${days === 1 ? '' : 's'} d’essai restants` : `Expire dans ${days} jour${days === 1 ? '' : 's'}`}</strong>
      <p class="meta">Fin : ${escapeHtml(new Date(sub.endDate).toLocaleDateString('fr-FR'))}</p>
    `;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      card.innerHTML += `<p class="meta">Aucun abonnement trouvé.</p>`;
      return;
    }
    card.innerHTML += `<div class="alert error">${escapeHtml(err.message)}</div>`;
  }
}

function render() {
  const path = pathOf();
  document.title = 'Infiny Stream';

  if (path === '/login') {
    mount(renderAuth('login'));
    bindAuth();
    return;
  }
  if (path === '/register') {
    mount(renderAuth('register'));
    bindAuth();
    return;
  }
  if (path === '/pair') {
    mount(renderPair());
    bindPair();
    return;
  }
  if (path === '/playlists') {
    if (!requireAuth('/playlists')) return;
    mount(renderPlaylists());
    bindPlaylists();
    return;
  }
  if (path === '/devices') {
    if (!requireAuth('/devices')) return;
    mount(renderDevices());
    refreshDevices();
    return;
  }
  if (path === '/account') {
    if (!requireAuth('/account')) return;
    mount(renderAccount());
    refreshAccount();
    return;
  }

  mount(renderHome());
}

window.addEventListener('popstate', render);
render();

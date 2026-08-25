/**
 * P2–P4 proofs against a live Xtream source.
 * Credentials via env (never committed):
 *   XTREAM_SERVER_URL, XTREAM_USERNAME, XTREAM_PASSWORD
 *
 * Usage: node scripts/pre-build-proofs.mjs
 */
const serverUrl = process.env.XTREAM_SERVER_URL;
const username = process.env.XTREAM_USERNAME;
const password = process.env.XTREAM_PASSWORD;
const IPTV_UA = 'Mozilla/5.0 (Linux; Android 10; Infiny Stream) AppleWebKit/537.36';

const PREFIX_RE = /^([A-Za-z]{2,3})\s*(?:[|:\-–—]\s*|\s+)/;

function languageFromCategoryName(name) {
  if (!name) return 'Autres';
  const m = PREFIX_RE.exec(name.trim());
  return m ? m[1].toUpperCase() : 'Autres';
}

function maskUrl(url) {
  return url.replace(/(\/(?:live|movie|series)\/)[^/]+\/[^/]+(\/)/gi, '$1***/***$2');
}

function apiUrl(action, extra = {}) {
  const base = serverUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    username,
    password,
    action,
    ...extra,
  });
  return `${base}/player_api.php?${params}`;
}

async function fetchJson(action, extra) {
  const res = await fetch(apiUrl(action, extra));
  if (!res.ok) throw new Error(`${action} HTTP ${res.status}`);
  return res.json();
}

function dedupeXtreamByProviderId(rows) {
  const seen = new Map();
  const channels = [];
  let duplicatesRemoved = 0;
  for (const row of rows) {
    const key = `${row.kind ?? 'movie'}::${row.xtreamStreamId ?? row.streamId}`;
    if (seen.has(key)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.set(key, true);
    channels.push(row);
  }
  return { channels, duplicatesRemoved };
}

function missingCredentials() {
  console.log('=== Pre-build proofs (P2–P4) ===');
  console.log('');
  console.log('[P2] IMPOSSIBLE sans credentials — définir XTREAM_SERVER_URL, XTREAM_USERNAME, XTREAM_PASSWORD');
  console.log('[P3] IMPOSSIBLE sans base SQLite importée (284k lignes) — pas de fichier .db local dans le repo');
  console.log('[P4] IMPOSSIBLE sans credentials Xtream pour construire l’URL réelle et tester HTTP');
}

async function proofP2() {
  const [live, vod, series] = await Promise.all([
    fetchJson('get_live_categories'),
    fetchJson('get_vod_categories'),
    fetchJson('get_series_categories'),
  ]);
  const allNames = [...live, ...vod, ...series].map((c) => String(c.category_name ?? ''));
  const languages = new Set(allNames.map(languageFromCategoryName));
  console.log('[P2] get_live_categories =', live.length);
  console.log('[P2] get_vod_categories  =', vod.length);
  console.log('[P2] get_series_categories =', series.length);
  console.log('[P2] langues distinctes (préfixe category_name) =', languages.size);
  console.log('[P2] langues =', [...languages].sort().join(', '));
}

async function proofP3() {
  const rawStreams = await fetchJson('get_vod_streams');
  const raw = rawStreams.map((v) => ({
    name: String(v.name ?? ''),
    streamId: Number(v.stream_id),
    kind: 'movie',
  }));
  const titleCounts = new Map();
  for (const row of raw) titleCounts.set(row.name, (titleCounts.get(row.name) ?? 0) + 1);
  const duplicateTitles = [...titleCounts.entries()].filter(([, c]) => c > 1);
  const { channels: after, duplicatesRemoved } = dedupeXtreamByProviderId(
    raw.map((v) => ({ ...v, xtreamStreamId: v.streamId }))
  );
  const afterCounts = new Map();
  for (const row of after) afterCounts.set(row.name, (afterCounts.get(row.name) ?? 0) + 1);
  const afterDupes = [...afterCounts.entries()].filter(([, c]) => c > 1);
  console.log('[P3] total films bruts (get_vod_streams) =', raw.length);
  console.log('[P3] titres en doublon par nom AVANT dedupe stream_id =', duplicateTitles.length);
  console.log('[P3] lignes supprimées par dedupe (kind+xtreamStreamId) =', duplicatesRemoved);
  console.log('[P3] titres en doublon par nom APRÈS =', afterDupes.length);
  console.log('[P3] total films APRÈS dedupe =', after.length);
  if (duplicateTitles.length > 0) {
    console.log(
      '[P3] exemple doublon nom AVANT:',
      duplicateTitles.slice(0, 3).map(([t, c]) => `${t} (${c})`).join(' | ')
    );
  }
}

async function proofP4() {
  const streams = await fetchJson('get_vod_streams');
  if (!streams.length) {
    console.log('[P4] ERREUR — pas de film disponible');
    return;
  }
  const film = streams[0];
  const streamId = Number(film.stream_id);
  const ext = String(film.container_extension || 'mp4').replace(/^\./, '');
  const base = serverUrl.replace(/\/$/, '');
  const url = `${base}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.${ext}`;
  console.log('[P4] film =', film.name);
  console.log('[P4] stream_id =', streamId, 'ext =', ext);
  console.log('[P4] URL (credentials masqués) =', maskUrl(url));
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': IPTV_UA, Accept: '*/*' },
      redirect: 'follow',
    });
    console.log('[P4] HTTP', res.status, res.statusText);
  } catch (err) {
    console.log('[P4] HTTP erreur réseau:', err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  if (!serverUrl || !username || !password) {
    missingCredentials();
    return;
  }
  console.log('=== Pre-build proofs (P2–P4) ===');
  await proofP2();
  console.log('');
  await proofP3();
  console.log('');
  await proofP4();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

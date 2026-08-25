/**
 * P1 proof: SQLite import throughput on a real file (node:sqlite).
 * Compares per-row INSERT vs multi-row INSERT (500 rows / statement).
 *
 * Usage: node scripts/bench-sqlite-import.mjs [rowCount]
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROW_COUNT = Number(process.argv[2] ?? 50_000);
const BATCH = 500;
const COLS = 22;
const CATALOG_ROWS = 284_421;

const CREATE = `
CREATE TABLE channels (
  id TEXT PRIMARY KEY NOT NULL,
  sourceId TEXT NOT NULL,
  name TEXT NOT NULL,
  streamUrl TEXT NOT NULL,
  logoUrl TEXT,
  groupTitle TEXT,
  tvgId TEXT,
  tvgName TEXT,
  country TEXT,
  category TEXT,
  xtreamCategoryId TEXT,
  sortIndex INTEGER NOT NULL,
  kind TEXT NOT NULL,
  plot TEXT,
  genre TEXT,
  rating REAL,
  releaseDate TEXT,
  containerExtension TEXT,
  xtreamStreamId INTEGER,
  xtreamSeriesId INTEGER,
  xtreamEpisodeId TEXT,
  isAdult INTEGER NOT NULL DEFAULT 0
);
`;

function makeRows(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push([
      `ch-${i}`,
      'src-bench',
      `Channel ${i}`,
      `http://example.com/live/${i}.m3u8`,
      null,
      null,
      null,
      null,
      null,
      i % 3 === 0 ? 'FR | ACTION' : 'EN | NEWS',
      null,
      i,
      i % 3 === 0 ? 'live' : i % 3 === 1 ? 'movie' : 'series',
      null,
      null,
      null,
      null,
      null,
      i,
      null,
      null,
      0,
    ]);
  }
  return rows;
}

function buildMultiSql(n) {
  const one = `(${Array.from({ length: COLS }, () => '?').join(',')})`;
  const values = Array.from({ length: n }, () => one).join(',');
  return `INSERT OR REPLACE INTO channels (${[
    'id', 'sourceId', 'name', 'streamUrl', 'logoUrl', 'groupTitle', 'tvgId', 'tvgName',
    'country', 'category', 'xtreamCategoryId', 'sortIndex', 'kind', 'plot', 'genre',
    'rating', 'releaseDate', 'containerExtension', 'xtreamStreamId', 'xtreamSeriesId',
    'xtreamEpisodeId', 'isAdult',
  ].join(', ')}) VALUES ${values}`;
}

function openDb(label) {
  const file = path.join(os.tmpdir(), `infiny-bench-${label}-${Date.now()}.db`);
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = OFF');
  db.exec(CREATE);
  return { db, file };
}

function benchSingleRow(rows) {
  const { db, file } = openDb('single');
  const insert = db.prepare(
    `INSERT OR REPLACE INTO channels VALUES (${Array.from({ length: COLS }, () => '?').join(',')})`
  );
  const t0 = performance.now();
  db.exec('BEGIN');
  for (const row of rows) insert.run(...row);
  db.exec('COMMIT');
  const elapsedSec = Math.max(0.001, (performance.now() - t0) / 1000);
  db.close();
  fs.unlinkSync(file);
  return { rowsPerSecond: Math.round(rows.length / elapsedSec), elapsedSec, nativeCalls: rows.length };
}

function benchMultiRow(rows) {
  const { db, file } = openDb('multi');
  const fullSql = buildMultiSql(BATCH);
  const t0 = performance.now();
  db.exec('BEGIN');
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const sql = slice.length === BATCH ? fullSql : buildMultiSql(slice.length);
    db.prepare(sql).run(...slice.flat());
  }
  db.exec('COMMIT');
  const elapsedSec = Math.max(0.001, (performance.now() - t0) / 1000);
  const nativeCalls = Math.ceil(rows.length / BATCH);
  db.close();
  fs.unlinkSync(file);
  return { rowsPerSecond: Math.round(rows.length / elapsedSec), elapsedSec, nativeCalls };
}

const rows = makeRows(ROW_COUNT);
console.log(`[P1] SQLite bench — ${ROW_COUNT.toLocaleString('fr-FR')} rows, real file (node:sqlite)`);
console.log(`[P1] script: scripts/bench-sqlite-import.mjs`);

const before = benchSingleRow(rows);
const after = benchMultiRow(rows);

const extrapolate = (rps) => ({
  seconds: (CATALOG_ROWS / rps).toFixed(1),
  minutes: (CATALOG_ROWS / rps / 60).toFixed(1),
});

console.log('');
console.log('[P1] AVANT (1 INSERT / row):');
console.log(`  rows/s = ${before.rowsPerSecond.toLocaleString('fr-FR')}`);
console.log(`  durée ${ROW_COUNT.toLocaleString('fr-FR')} rows = ${before.elapsedSec.toFixed(2)}s`);
console.log(`  extrapolé ${CATALOG_ROWS.toLocaleString('fr-FR')} rows = ${extrapolate(before.rowsPerSecond).seconds}s (${extrapolate(before.rowsPerSecond).minutes} min)`);
console.log(`  native calls = ${before.nativeCalls.toLocaleString('fr-FR')}`);

console.log('');
console.log(`[P1] APRÈS (multi-row ${BATCH}):`);
console.log(`  rows/s = ${after.rowsPerSecond.toLocaleString('fr-FR')}`);
console.log(`  durée ${ROW_COUNT.toLocaleString('fr-FR')} rows = ${after.elapsedSec.toFixed(2)}s`);
console.log(`  extrapolé ${CATALOG_ROWS.toLocaleString('fr-FR')} rows = ${extrapolate(after.rowsPerSecond).seconds}s (${extrapolate(after.rowsPerSecond).minutes} min)`);
console.log(`  native calls = ${after.nativeCalls.toLocaleString('fr-FR')}`);

console.log('');
console.log(`[P1] speedup ≈ ${(after.rowsPerSecond / before.rowsPerSecond).toFixed(1)}×`);

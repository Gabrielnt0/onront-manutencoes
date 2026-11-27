import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const app = read('app.js');
const bike3d = read('bike3d.js');
const css = read('styles.css');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

test('elementos obrigatórios da interface existem', () => {
  const ids = ['bikesButton', 'settingsButton', 'updateKmButton', 'scanOdometerButton', 'addFuelButton', 'addAttachmentButton', 'costPerKm', 'avgConsumption', 'fuelList', 'attachmentList', 'calendarButton', 'syncExportButton', 'syncImportButton', 'syncQr', 'calendarGrid', 'calendarForecast', 'calendarTodayButton', 'dayDialog', 'dayKm', 'deleteDayButton', 'tireGrid', 'tireSettingsButton', 'tireDialog', 'tireForm', 'frontStartKm', 'frontLifeKm', 'rearStartKm', 'rearLifeKm', 'signatureButton', 'pushInput', 'vapidInput', 'themeSelect', 'langSelect', 'serviceOrder'];
  ids.forEach(id => assert.match(html, new RegExp(`id="${id}"`), `falta #${id}`));
});

test('estado persistente contém as chaves da Fase 2', () => {
  ['fuelLog:', 'ui: { theme:', 'push: { enabled:', 'signature: null', 'const defaultTires', 'function normalizeState(saved)'].forEach(fragment => assert.ok(app.includes(fragment), `falta ${fragment}`));
  ['data.fuelLog', 'data.ui', 'data.push', 'data.signature'].forEach(fragment => assert.ok(app.includes(fragment), `normalização ausente: ${fragment}`));
});

test('recursos avançados estão presentes', () => {
  assert.ok(app.includes('CompressionStream'));
  assert.ok(app.includes('TextDetector'));
  assert.ok(app.includes('PushManager'));
  assert.ok(app.includes('BEGIN:VCALENDAR'));
  assert.ok(app.includes('toDataURL'));
  assert.ok(css.includes('[data-theme="light"]'));
  assert.ok(app.includes('  en: {'));
  assert.ok(app.includes('  es: {'));
  assert.ok(app.includes('renderSyncQr'));
  assert.ok(app.includes("crypto.subtle.digest('SHA-256'"));
  assert.ok(app.includes("prefers-color-scheme: light"));
  assert.ok(app.includes("function renderCalendar()"));
  assert.ok(app.includes("function estimateKm(key)"));
  assert.ok(app.includes("forecastDate: effectiveDate"));
  assert.ok(app.includes("function tireForecasts()"));
  assert.ok(app.includes("function renderTires()"));
  assert.ok(css.includes('.tire-track'));
  assert.ok(app.includes('tire.startKm == null'));
});

test('manifesto e service worker apontam para a versão atual', () => {
  assert.equal(manifest.shortcuts.length, 3);
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url.includes('action=km')));
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url.includes('action=checklist')));
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url.includes('action=calendar')));
  assert.ok(sw.includes('onront-manutencoes-v21'));
  ['styles.css?v=20', 'bike3d.js?v=20', 'qrcode.js?v=20', 'app.js?v=20'].forEach(asset => assert.ok(sw.includes(asset)));
  const refs = html.match(/src="(app|bike3d|qrcode)\.js\?v=\d+"|href="styles\.css\?v=\d+"/g) || [];
  assert.equal(refs.length, 4);
  refs.forEach(ref => assert.ok(ref.includes('v=20'), `referência desatualizada: ${ref}`));
});

test('modelo 3D destaca a peça selecionada', () => {
  assert.ok(bike3d.includes('focusPart(name)'));
  assert.ok(bike3d.includes('sideParts'));
  assert.ok(bike3d.includes('camera.zoomTarget = 1.85'));
  assert.ok(app.includes('bikeModel.focusPart(name)'));
  assert.match(html, /toque em uma peça para ampliar/i);
});

test('correções P0/P1 de data, i18n, sincronização e acessibilidade', () => {
  assert.ok(app.includes('const today = () => dateKey(new Date())'));
  assert.ok(app.includes('const validDateKey = value =>'));
  assert.ok(app.includes('function normalizeState(saved)'));
  assert.ok(app.includes('normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)))'));
  assert.ok(app.includes('normalizeState(JSON.parse(text))'));
  assert.ok(app.includes('normalizeState(JSON.parse(await event.target.files[0].text()))'));
  assert.ok(app.includes('const resolveI18nSource = (raw, cached) =>'));
  assert.ok(app.includes('node.parentElement?.closest(\'script, style, svg\')'));
  assert.ok(app.includes('showPart(bikeFocus);'));
  assert.ok(app.includes("const date = data.forecastDate"));
  assert.ok(app.includes("withTimeout(navigator.serviceWorker.ready, 3000)"));
  assert.ok(app.includes("aria-current=\"date\""));
  assert.match(html, /id="bike3dCanvas"[^>]*tabindex="0"/);
  assert.match(html, /aria-describedby="bike3dHelp swipeHint"/);
  assert.ok(html.includes('id="inspectionIcon"'));
  assert.ok(css.includes('.sr-only'));
  assert.doesNotMatch(css, /\.swipe-hint\s*\{[^}]*white-space:nowrap/);
});

test('nenhuma dependência externa em runtime', () => {
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\/[^"]+\.css/);
});

const section = (start, end) => {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  assert.ok(from >= 0, `seção não encontrada: ${start}`);
  assert.ok(to > from, `fim não encontrado: ${end}`);
  return app.slice(from, to);
};
const coreSource = section('const STORAGE_KEY', 'let state = loadState();') + section('const I18N = {', 'function saveState');

function makeApp(stored) {
  const store = new Map(stored ? [[STORAGE_KEY, JSON.stringify(stored)]] : []);
  let id = 0;
  const textNodes = [];
  const elements = [];
  const sandbox = {
    console, Date, Math, Number, String, Array, Object, Set, Map, JSON, Intl, RegExp, Boolean, isNaN,
    crypto: { randomUUID: () => `test-${++id}` },
    matchMedia: () => ({ matches: false }),
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    document: {
      documentElement: {}, body: {},
      createTreeWalker: () => { let index = 0; return { nextNode: () => textNodes[index++] ?? null }; },
      querySelectorAll: () => elements
    },
    __nodes: textNodes, __elements: elements
  };
  vm.createContext(sandbox);
  vm.runInContext(`${coreSource}\nlet state = loadState();\nglobalThis.__api = { loadState, normalizeState, applyLang, getState: () => state, setState: value => { state = value; } };`, sandbox);
  return sandbox;
}
const STORAGE_KEY = 'moto-em-dia-v1';
const textNode = value => ({ nodeValue: value, parentElement: { closest: () => null } });
const setLang = (env, lang) => {
  const current = env.__api.getState();
  env.__api.setState({ ...current, ui: { theme: 'dark', lang } });
  env.__api.applyLang();
};

const legacySave = () => ({
  bike: { id: 'bike-1', name: 'TVS Sport', year: '2026', currentKm: 195598, historyUnknown: false },
  scheduleVersion: 'old',
  maintenance: [{ id: 'm1', name: 'Pastilhas de freio', lastKm: 195000, lastDate: '2026-10-01', intervalKm: 5000, intervalMonths: 3, firstKm: 1000, firstMonths: 1, icon: '🛑', cost: 120 }],
  odometerHistory: [{ date: '2026-11-26', km: 195000 }, { date: 'bad', km: 50 }, { date: '2026-11-27', km: 195598 }],
  serviceLog: [{ id: 's1', date: '2026-10-02', km: 195000, name: 'Revisão', cost: 100, note: 'ok' }],
  fuelLog: [{ id: 'f1', date: '2026-11-20', km: 195000, liters: 5, price: 40, station: 'Posto' }],
  inspection: { date: '2026-11-01', km: 194000, checks: { a: true } },
  ui: { theme: 'light', lang: 'pt' },
  signature: 'data:image/png;base64,aaa',
  roster: [{ bike: { id: 'bike-2', name: 'Mottu Sport', currentKm: 100 }, maintenance: [] }]
});

test('loadState preserva dados e aplica upgrade com scheduleVersion antigo (P0)', () => {
  const env = makeApp(legacySave());
  const data = env.__api.loadState();
  assert.equal(data.bike.currentKm, 195598);
  assert.equal(data.bike.id, 'bike-1');
  assert.equal(data.scheduleVersion, 'mottu-sport-2026');
  assert.ok(data.maintenance.some(item => item.name === 'Inspeção dos freios'));
  assert.ok(!data.maintenance.some(item => item.name === 'Pastilhas de freio'));
  assert.equal(data.maintenance.length, 9);
  assert.equal(JSON.stringify(data.odometerHistory), JSON.stringify([{ date: '2026-11-26', km: 195000 }, { date: '2026-11-27', km: 195598 }]));
  assert.equal(data.serviceLog.length, 1);
  assert.equal(data.fuelLog.length, 1);
  assert.ok(data.inspection);
  assert.equal(data.signature, 'data:image/png;base64,aaa');
  assert.deepEqual(data.roster.map(item => item.bike.name), ['Mottu Sport']);
});

test('loadState aplica upgrade quando scheduleVersion está ausente', () => {
  const saved = legacySave();
  delete saved.scheduleVersion;
  saved.maintenance = [
    { id: 'm1', name: 'Pneus', lastKm: 190000, lastDate: '2026-09-01', intervalKm: 5000, intervalMonths: 3 },
    { id: 'm2', name: 'Relação e corrente', lastKm: 190000, lastDate: '2026-09-01', intervalKm: 5000, intervalMonths: 3 }
  ];
  const data = makeApp(saved).__api.loadState();
  assert.equal(data.scheduleVersion, 'mottu-sport-2026');
  assert.ok(data.maintenance.some(item => item.name === 'Inspeção dos pneus'));
  assert.ok(data.maintenance.some(item => item.name === 'Corrente: limpar, lubrificar e ajustar'));
  assert.equal(data.maintenance.length, 9);
});

test('applyLang não reaplica texto antigo sobre conteúdo dinâmico (P1)', () => {
  const env = makeApp();
  const node = textNode('Aprendendo');
  env.__nodes.push(node);
  setLang(env, 'pt');
  assert.equal(node.nodeValue, 'Aprendendo');
  node.nodeValue = '1.234 km/mês';
  setLang(env, 'en');
  assert.equal(node.nodeValue, '1.234 km/mês');
  assert.equal(node.__srcText, null);
});

test('applyLang preserva rótulos distintos com traduções colidentes', () => {
  const env = makeApp();
  const view = textNode('Frente');
  const tire = textNode('Dianteiro');
  env.__nodes.push(view, tire);
  setLang(env, 'pt');
  assert.equal(view.nodeValue, 'Frente');
  assert.equal(tire.nodeValue, 'Dianteiro');
  setLang(env, 'en');
  assert.equal(view.nodeValue, 'Front');
  assert.equal(tire.nodeValue, 'Front');
  setLang(env, 'pt');
  assert.equal(view.nodeValue, 'Frente');
  assert.equal(tire.nodeValue, 'Dianteiro');
});

test('applyLang retorna texto traduzido ao idioma original', () => {
  const env = makeApp();
  const node = textNode('Tap a marker');
  node.__srcText = 'Toque em um ponto';
  env.__nodes.push(node);
  setLang(env, 'pt');
  assert.equal(node.nodeValue, 'Toque em um ponto');
  setLang(env, 'en');
  assert.equal(node.nodeValue, 'Tap a marker');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const app = read('app.js');
const css = read('styles.css');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

test('elementos obrigatórios da interface existem', () => {
  const ids = ['bikesButton', 'settingsButton', 'updateKmButton', 'scanOdometerButton', 'addFuelButton', 'addAttachmentButton', 'costPerKm', 'avgConsumption', 'fuelList', 'attachmentList', 'calendarButton', 'syncExportButton', 'syncImportButton', 'signatureButton', 'pushInput', 'vapidInput', 'themeSelect', 'langSelect', 'serviceOrder'];
  ids.forEach(id => assert.match(html, new RegExp(`id="${id}"`), `falta #${id}`));
});

test('estado persistente contém as chaves da Fase 2', () => {
  ['fuelLog:', 'ui: { theme:', 'push: { enabled:', 'signature: null'].forEach(fragment => assert.ok(app.includes(fragment), `falta ${fragment}`));
  ['saved.fuelLog', 'saved.ui', 'saved.push', 'saved.signature'].forEach(fragment => assert.ok(app.includes(fragment), `migração ausente: ${fragment}`));
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
});

test('manifesto e service worker apontam para a versão atual', () => {
  assert.equal(manifest.shortcuts.length, 2);
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url.includes('action=km')));
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url.includes('action=checklist')));
  assert.ok(sw.includes('onront-manutencoes-v14'));
  ['styles.css?v=13', 'bike3d.js?v=13', 'app.js?v=13'].forEach(asset => assert.ok(sw.includes(asset)));
  html.match(/src="(app|bike3d)\.js\?v=\d+"|href="styles\.css\?v=\d+"/g).forEach(ref => assert.ok(ref.includes('v=13')));
});

test('nenhuma dependência externa em runtime', () => {
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\/[^"]+\.css/);
});

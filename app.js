const STORAGE_KEY = 'moto-em-dia-v1';
const DAY = 86400000;

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const defaultState = () => ({
  bike: { id: uid(), name: 'TVS Sport', year: '', currentKm: 0, historyUnknown: false },
  odometerHistory: [],
  scheduleVersion: 'mottu-sport-2026',
  serviceLog: [],
  inspection: null,
  notificationsOn: false,
  roster: [],
  maintenance: [
    ['Óleo do motor', 5000, 3, '🛢️', 1000, 1], ['Revisão periódica', 5000, 3, '🔍', 1000, 1],
    ['Inspeção dos freios', 5000, 3, '🛑', 1000, 1], ['Inspeção dos pneus', 5000, 3, '◉', 1000, 1],
    ['Corrente: limpar, lubrificar e ajustar', 5000, 3, '⛓️', 1000, 1], ['Filtro de ar', 12000, 0, '🌬️', 12000, 0],
    ['Vela de ignição', 12000, 0, '⚡', 12000, 0], ['Óleo da bengala dianteira', 18000, 0, '🔧', 18000, 0],
    ['Filtro de combustível', 24000, 0, '⛽', 24000, 0]
  ].map(([name, intervalKm, intervalMonths, icon, firstKm, firstMonths]) => ({ id: uid(), name, intervalKm, intervalMonths, firstKm, firstMonths, lastKm: 0, lastDate: today(), icon }))
});

let state = loadState();
const $ = selector => document.querySelector(selector);
const list = $('#maintenanceList');
const partInfo = {
  'Motor': ['⚙️', 'Motor', 'Observe vazamentos, ruídos diferentes, dificuldade de partida ou perda de força.', 'Não abra o motor sem conhecimento técnico.'],
  'Óleo do motor': ['🛢️', 'Óleo do motor', 'Confira o nível com a moto vertical, em piso plano e conforme o procedimento do manual.', 'Motor quente e óleo usado podem causar queimaduras.'],
  'Corrente': ['⛓️', 'Corrente', 'Verifique limpeza, lubrificação e folga. A Mottu indica limite de 20–30 mm.', 'Nunca inspecione com o motor ligado.'],
  'Freio dianteiro': ['🛑', 'Freio dianteiro', 'Observe disco, pinça, resposta da manete e sinais de desgaste ou vazamento.', 'Freios são item crítico; procure uma oficina em caso de dúvida.'],
  'Pneu dianteiro': ['◉', 'Pneu dianteiro', 'Verifique pressão a frio, cortes, objetos presos e indicador TWI.', 'Não pilote com bolhas, cortes profundos ou lona aparente.'],
  'Pneu traseiro': ['◉', 'Pneu traseiro', 'Verifique pressão a frio, desgaste central, cortes e indicador TWI.', 'Não pilote com bolhas, cortes profundos ou lona aparente.'],
  'Suspensão dianteira': ['🔧', 'Suspensão dianteira', 'Procure óleo nas bengalas, batidas secas, folga ou retorno irregular.', 'Reparo exige ferramentas e procedimento correto.'],
  'Suspensão traseira': ['🔧', 'Suspensão traseira', 'Observe vazamentos, molas danificadas, fixações e comportamento em irregularidades.', 'Não desmonte o amortecedor sob carga.'],
  'Filtro de ar': ['🌬️', 'Filtro de ar', 'Fica sob a carenagem lateral. Em locais empoeirados, pode precisar de atenção antecipada.', 'Confirme o acesso e o elemento correto no manual.'],
  'Farol': ['💡', 'Farol', 'Teste luz alta, baixa, alinhamento, lente e conexões visíveis.', 'Desligue a ignição antes de acessar conectores.'],
  'Escapamento': ['♨️', 'Escapamento', 'Observe fixações, corrosão, ruído anormal e possíveis vazamentos.', 'Espere esfriar completamente antes de tocar.'],
  'Lanterna e piscas': ['💡', 'Lanterna e piscas', 'Teste lanterna, luz de freio e ambos os indicadores de direção.', 'Peças elétricas devem ser verificadas com cuidado.']
};
const partMaintenance = {
  'Motor': 'Revisão periódica', 'Óleo do motor': 'Óleo do motor', 'Corrente': 'Corrente: limpar, lubrificar e ajustar',
  'Freio dianteiro': 'Inspeção dos freios', 'Pneu dianteiro': 'Inspeção dos pneus', 'Pneu traseiro': 'Inspeção dos pneus',
  'Suspensão dianteira': 'Óleo da bengala dianteira', 'Suspensão traseira': 'Revisão periódica', 'Filtro de ar': 'Filtro de ar',
  'Farol': 'Revisão periódica', 'Escapamento': 'Revisão periódica', 'Lanterna e piscas': 'Revisão periódica'
};
// Referência visual inicial derivada das fotos enviadas; não substitui medição física.
const photoAssessment = {
  'Motor': ['sem vazamento externo evidente', 'média'],
  'Corrente': ['visível, mas sem resolução para medir folga ou alongamento', 'baixa'],
  'Freio dianteiro': ['disco visível; espessura da pastilha não mensurável', 'baixa'],
  'Pneu dianteiro': ['sulcos visíveis, sem corte evidente no ângulo fotografado', 'média'],
  'Pneu traseiro': ['sulcos visíveis, sem lona ou bolha aparente', 'média'],
  'Suspensão dianteira': ['sem vazamento evidente nas áreas visíveis', 'média'],
  'Suspensão traseira': ['molas e fixações externas aparentam íntegras', 'média'],
  'Farol': ['lente aparentemente íntegra; funcionamento não confirmado', 'média'],
  'Escapamento': ['marcas de uso externas, sem dano estrutural evidente', 'média'],
  'Lanterna e piscas': ['lentes aparentemente íntegras; funcionamento não confirmado', 'média']
};

const formatMoney = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const markerStatusColors = { ok: '#54d691', warning: '#ffc857', overdue: '#ff6961' };
let bikeModel = null;
const notifiedThisSession = new Set();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.bike || !Array.isArray(saved.maintenance)) return defaultState();
    saved.odometerHistory = Array.isArray(saved.odometerHistory) ? saved.odometerHistory : [];
    saved.serviceLog = Array.isArray(saved.serviceLog) ? saved.serviceLog : [];
    saved.roster = Array.isArray(saved.roster) ? saved.roster : [];
    saved.inspection = saved.inspection && typeof saved.inspection === 'object' ? saved.inspection : null;
    saved.notificationsOn = Boolean(saved.notificationsOn);
    if (!saved.bike.id) saved.bike.id = uid();
    if (saved.scheduleVersion !== 'mottu-sport-2026') {
      const upgrades = {
        'Óleo do motor': ['Óleo do motor', 5000, 3, 1000, 1],
        'Pastilhas de freio': ['Inspeção dos freios', 5000, 3, 1000, 1],
        'Pneus': ['Inspeção dos pneus', 5000, 3, 1000, 1],
        'Relação e corrente': ['Corrente: limpar, lubrificar e ajustar', 5000, 3, 1000, 1],
        'Filtro de ar': ['Filtro de ar', 12000, 0, 12000, 0],
        'Vela de ignição': ['Vela de ignição', 12000, 0, 12000, 0]
      };
      saved.maintenance.forEach(item => { const upgrade = upgrades[item.name]; if (upgrade) [item.name, item.intervalKm, item.intervalMonths, item.firstKm, item.firstMonths] = upgrade; });
      const present = new Set(saved.maintenance.map(item => item.name));
      defaultState().maintenance.filter(item => !present.has(item.name)).forEach(item => saved.maintenance.push(item));
      saved.scheduleVersion = 'mottu-sport-2026';
    }
    return saved;
  } catch { return defaultState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }

function showPart(name) {
  const [icon, title, description, safety] = partInfo[name];
  $('#partIcon').textContent = icon; $('#partTitle').textContent = title; $('#partDescription').textContent = description; $('#partSafety').textContent = safety;
  const maintenance = state.maintenance.find(item => item.name === partMaintenance[name]);
  const wear = maintenance ? maintenanceStatus(maintenance) : null;
  const usedKm = maintenance ? Math.max(0, Number(state.bike.currentKm) - Number(maintenance.lastKm)) : 0;
  $('#partWear').classList.toggle('hidden', !wear);
  if (wear) {
    const percent = Math.round(wear.progress);
    $('#partWearValue').textContent = `${percent}%`;
    $('#partWearFill').style.width = `${percent}%`;
    $('#partWearMeta').textContent = `${formatNumber(usedKm)} km usados desde a última referência • ${wear.reason}`;
    const visual = photoAssessment[name];
    $('#partPhotoEstimate').textContent = visual ? `Fotos: ${visual[0]} (confiança ${visual[1]}).` : 'Fotos: esta peça não pode ser avaliada visualmente com segurança.';
  }
}

function initBikeViewer() {
  const views = [['Esquerda', 0], ['Frente', Math.PI / 2], ['Direita', Math.PI], ['Traseira', -Math.PI / 2]];
  bikeModel = window.Moto3D.init($('#bike3dCanvas'), showPart);
  views.forEach(([label, yaw], index) => {
    const button = document.createElement('button');
    button.className = 'angle-tab'; button.type = 'button'; button.textContent = label;
    button.setAttribute('aria-pressed', String(index === 0));
    button.addEventListener('click', () => {
      bikeModel.setView(yaw);
      document.querySelectorAll('.angle-tab').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    });
    $('#angleTabs').append(button);
  });
}
function addMonths(dateString, months) { const date = new Date(`${dateString}T12:00:00`); date.setMonth(date.getMonth() + Number(months)); return date; }
function formatDate(date) { return new Intl.DateTimeFormat('pt-BR').format(date); }
function formatNumber(number) { return new Intl.NumberFormat('pt-BR').format(Math.max(0, Math.round(number))); }

function usageForecast() {
  const history = [...state.odometerHistory].sort((a, b) => a.date.localeCompare(b.date));
  if (history.length < 2) return { daily: 0, monthly: 0 };
  const first = history[0], last = history.at(-1);
  const days = Math.max(1, (new Date(`${last.date}T12:00:00`) - new Date(`${first.date}T12:00:00`)) / DAY);
  const daily = Math.max(0, (Number(last.km) - Number(first.km)) / days);
  return { daily, monthly: daily * 30.44 };
}

function renderSmartAssistant(items) {
  const usage = usageForecast();
  const overdue = items.filter(entry => entry.data.status === 'overdue').length;
  const warning = items.filter(entry => entry.data.status === 'warning').length;
  const worstProgress = Math.max(0, ...items.map(entry => entry.data.progress));
  const health = state.bike.historyUnknown ? Math.min(55, Math.max(0, Math.round(100 - overdue * 25 - warning * 5))) : Math.max(0, Math.round(100 - overdue * 25 - warning * 10 - Math.max(0, worstProgress - 70) * .25));
  const currentKm = Number(state.bike.currentKm);
  const milestone = currentKm < 1000 ? 1000 : 1000 + (Math.floor((currentKm - 1000) / 5000) + 1) * 5000;
  const urgent = items.sort((a, b) => b.data.progress - a.data.progress)[0];
  $('#healthScore').textContent = health;
  $('#healthScore').parentElement.dataset.level = health < 50 ? 'danger' : health < 75 ? 'warning' : 'ok';
  $('#usageRate').textContent = usage.monthly ? `${formatNumber(usage.monthly)} km/mês` : 'Aprendendo';
  $('#nextMilestone').textContent = `${formatNumber(milestone)} km`;
  $('#confirmDeliveryReviewButton').classList.toggle('hidden', !state.bike.historyUnknown || currentKm <= 0);
  if (state.bike.historyUnknown) $('#smartInsight').textContent = 'Histórico desconhecido: faça uma revisão de entrada antes de confiar nos prazos. Priorize óleo, freios, pneus, corrente, filtro de ar, vela e suspensão.';
  else if (!urgent) $('#smartInsight').textContent = 'Cadastre uma manutenção para iniciar a análise preventiva.';
  else if (urgent.data.status === 'overdue') $('#smartInsight').textContent = `Prioridade alta: ${urgent.item.name} está vencida. Evite adiar e faça uma inspeção antes de continuar usando a moto.`;
  else if (urgent.data.status === 'warning') $('#smartInsight').textContent = `Antecipe ${urgent.item.name}: ${urgent.data.reason.toLowerCase()}.`;
  else $('#smartInsight').textContent = `Tudo em dia. O próximo item a acompanhar é ${urgent.item.name}, com ${urgent.data.reason.toLowerCase()}.`;
  $('#learningHint').textContent = usage.daily ? `No ritmo atual, o assistente projeta os prazos usando ${usage.daily.toFixed(1).replace('.', ',')} km por dia.` : 'Atualize o hodômetro em dias diferentes. Após duas leituras, o app aprende seu ritmo e passa a estimar datas.';
}

function maintenanceStatus(item) {
  const kmLimit = Number(item.intervalKm) > 0 ? (Number(item.lastKm) === 0 && Number(item.firstKm) > 0 ? Number(item.firstKm) : Number(item.lastKm) + Number(item.intervalKm)) : Infinity;
  const kmLeft = kmLimit - Number(state.bike.currentKm);
  const monthsToUse = Number(item.lastKm) === 0 && Number(item.firstMonths) > 0 ? Number(item.firstMonths) : Number(item.intervalMonths);
  const dateLimit = monthsToUse > 0 ? addMonths(item.lastDate, monthsToUse) : null;
  const daysLeft = dateLimit ? Math.ceil((dateLimit - new Date()) / DAY) : Infinity;
  const kmProgress = Number.isFinite(kmLimit) ? (Number(state.bike.currentKm) - Number(item.lastKm)) / Number(item.intervalKm) : 0;
  const dateProgress = dateLimit ? (new Date() - new Date(`${item.lastDate}T12:00:00`)) / (dateLimit - new Date(`${item.lastDate}T12:00:00`)) : 0;
  const progress = Math.max(kmProgress, dateProgress, 0);
  if ((state.bike.historyUnknown || item.historyUnknown) && Number(item.lastKm) === 0) return { status: 'warning', progress: 90, reason: item.historyUnknown ? 'Confirmar na ordem de serviço' : 'Histórico desconhecido', next: 'confirmar manutenção' };
  const overdue = kmLeft <= 0 || daysLeft <= 0;
  const warning = !overdue && (kmLeft <= Math.max(300, Number(item.intervalKm) * .1) || daysLeft <= 30 || progress >= .9);
  const reason = kmLeft <= 0 ? `${formatNumber(Math.abs(kmLeft))} km atrasado` : daysLeft <= 0 ? `${Math.abs(daysLeft)} dias atrasado` : warning ? (kmLeft / Math.max(daysLeft, 1) < 15 ? `Faltam ${formatNumber(kmLeft)} km` : `Faltam ${daysLeft} dias`) : Number.isFinite(kmLeft) ? `${formatNumber(kmLeft)} km restantes` : `${daysLeft} dias restantes`;
  const usage = usageForecast();
  const forecastDate = usage.daily > 0 && Number.isFinite(kmLeft) && kmLeft > 0 ? new Date(Date.now() + (kmLeft / usage.daily) * DAY) : null;
  const effectiveDate = forecastDate && (!dateLimit || forecastDate < dateLimit) ? forecastDate : dateLimit;
  const next = [Number.isFinite(kmLimit) ? `${formatNumber(kmLimit)} km` : '', effectiveDate ? `estimativa ${formatDate(effectiveDate)}` : ''].filter(Boolean).join(' · ');
  return { status: overdue ? 'overdue' : warning ? 'warning' : 'ok', progress: Math.min(progress * 100, 100), reason, next };
}

function render() {
  $('#bikeName').textContent = `${state.bike.name}${state.bike.year ? ` · ${state.bike.year}` : ''}`;
  $('#currentKm').textContent = formatNumber(state.bike.currentKm);
  const counts = { ok: 0, warning: 0, overdue: 0 };
  list.innerHTML = '';
  const statusOrder = { overdue: 0, warning: 1, ok: 2 };
  const analyzed = state.maintenance.map(item => ({ item, data: maintenanceStatus(item) }));
  analyzed.sort((a, b) => statusOrder[a.data.status] - statusOrder[b.data.status]).forEach(({ item, data }) => {
    counts[data.status]++;
    const card = $('#maintenanceTemplate').content.firstElementChild.cloneNode(true);
    card.dataset.status = data.status;
    card.querySelector('.status-icon').textContent = item.icon || '🔧';
    card.querySelector('.item-title').textContent = item.name;
    card.querySelector('.item-detail').textContent = `Próxima: ${data.next}`;
    card.querySelector('.wear-copy').textContent = `Uso do ciclo: ${Math.round(data.progress)}% • ${formatNumber(Math.max(0, Number(state.bike.currentKm) - Number(item.lastKm)))} km`;
    card.querySelector('.progress-fill').style.width = `${data.progress}%`;
    card.querySelector('.status-copy').textContent = data.reason;
    card.querySelector('button').addEventListener('click', () => openMaintenance(item));
    list.append(card);
  });
  if (!state.maintenance.length) list.innerHTML = '<div class="empty">Nenhuma manutenção cadastrada.</div>';
  $('#okCount').textContent = counts.ok; $('#warningCount').textContent = counts.warning; $('#overdueCount').textContent = counts.overdue;
  const totalCost = state.serviceLog.reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0);
  $('#totalCost').textContent = totalCost > 0 ? formatMoney(totalCost) : '—';
  $('#serviceCount').textContent = state.serviceLog.length;
  renderServiceLog();
  renderUsageChart();
  renderInspection();
  updateMarkerStatuses(analyzed);
  renderSmartAssistant(analyzed);
}

const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function renderServiceLog() {
  const container = $('#serviceLogList');
  const log = [...state.serviceLog].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || Number(b.km) - Number(a.km));
  $('#serviceLogBadge').textContent = `${log.length} ${log.length === 1 ? 'registro' : 'registros'}`;
  if (!log.length) { container.innerHTML = '<div class="empty">Nenhum serviço registrado. Ao editar uma manutenção, o registro entra aqui.</div>'; return; }
  container.innerHTML = log.slice(0, 30).map(entry => `
    <article class="log-entry">
      <strong>${escapeHtml(entry.name)}</strong>
      <span class="log-cost">${Number(entry.cost) > 0 ? formatMoney(Number(entry.cost)) : ''}</span>
      <span class="log-date">${entry.date ? formatDate(new Date(`${entry.date}T12:00:00`)) : '—'}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}</span>
      <span class="log-km">${formatNumber(entry.km)} km</span>
    </article>`).join('');
}

function renderUsageChart() {
  const container = $('#usageChart');
  const history = [...state.odometerHistory].sort((a, b) => a.date.localeCompare(b.date));
  if (history.length < 2) { container.innerHTML = '<p class="chart-hint">Gráfico de uso disponível após 2 leituras de hodômetro em dias diferentes.</p>'; return; }
  const width = 300, height = 74, pad = 8;
  const kms = history.map(reading => Number(reading.km));
  const minKm = Math.min(...kms), maxKm = Math.max(...kms);
  const span = Math.max(1, maxKm - minKm);
  const points = history.map((reading, index) => {
    const x = pad + index * (width - pad * 2) / (history.length - 1);
    const y = height - pad - ((Number(reading.km) - minKm) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const usage = usageForecast();
  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${points}" fill="none" stroke="#54d691" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>
    </svg>
    <div class="chart-caption"><span>${history.length} leituras · ${formatNumber(minKm)}–${formatNumber(maxKm)} km</span><span>${usage.daily > 0 ? `${usage.daily.toFixed(1).replace('.', ',')} km/dia` : 'Ritmo em aprendizado'}</span></div>`;
}

function renderInspection() {
  const card = $('#inspectionCard');
  const inspection = state.inspection;
  const total = document.querySelectorAll('#inspectionForm [name="chk"]').length || 12;
  if (inspection?.date) {
    const count = Object.keys(inspection.checks || {}).length;
    card.classList.add('done'); card.classList.remove('pending');
    $('#inspectionStatus').textContent = `Última inspeção: ${formatDate(new Date(`${inspection.date}T12:00:00`))}`;
    $('#inspectionMeta').textContent = `${count}/${total} itens verificados • ${formatNumber(inspection.km)} km`;
  } else {
    card.classList.add('pending'); card.classList.remove('done');
    $('#inspectionStatus').textContent = 'Nenhuma inspeção registrada';
    $('#inspectionMeta').textContent = 'Verifique freios, pneus, corrente e luzes';
  }
}

function updateMarkerStatuses(analyzed) {
  if (!bikeModel) return;
  const statusByName = new Map(analyzed.map(({ item, data }) => [item.name, data.status]));
  Object.entries(partMaintenance).forEach(([part, itemName]) => {
    bikeModel.setStatus(part, markerStatusColors[statusByName.get(itemName)] || markerStatusColors.ok);
  });
}

function checkNotifications() {
  if (!state.notificationsOn || !('Notification' in window) || Notification.permission !== 'granted') return;
  state.maintenance.forEach(item => {
    const status = maintenanceStatus(item);
    if (status.status !== 'ok' && !notifiedThisSession.has(item.id)) {
      notifiedThisSession.add(item.id);
      try { new Notification(status.status === 'overdue' ? '⚠️ Manutenção vencida' : '🔔 Manutenção se aproximando', { body: `${item.name}: ${status.reason}.`, icon: 'icon.svg' }); } catch { /* notificação indisponível */ }
    }
  });
}

function openMaintenance(item) {
  $('#maintenanceForm').reset(); $('#maintenanceError').textContent = '';
  $('#maintenanceId').value = item?.id || '';
  $('#maintenanceDialogTitle').textContent = item ? 'Editar manutenção' : 'Nova manutenção';
  $('#itemName').value = item?.name || ''; $('#lastKm').value = item?.lastKm ?? state.bike.currentKm;
  $('#intervalKm').value = item?.intervalKm || ''; $('#lastDate').value = item?.lastDate || today(); $('#intervalMonths').value = item?.intervalMonths || '';
  $('#itemCost').value = item?.cost > 0 ? item.cost : '';
  $('#deleteMaintenanceButton').classList.toggle('hidden', !item);
  $('#maintenanceDialog').showModal();
}

$('#updateKmButton').addEventListener('click', () => { $('#kmInput').value = state.bike.currentKm; $('#unknownHistoryInput').checked = Boolean(state.bike.historyUnknown); $('#kmError').textContent = ''; $('#kmDialog').showModal(); });
$('#kmForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  const value = Number($('#kmInput').value);
  if (!Number.isFinite(value) || value < state.bike.currentKm) { event.preventDefault(); $('#kmError').textContent = 'A quilometragem não pode ser menor que a atual.'; return; }
  state.bike.currentKm = value;
  state.bike.historyUnknown = $('#unknownHistoryInput').checked;
  const existingReading = state.odometerHistory.find(reading => reading.date === today());
  if (existingReading) existingReading.km = value;
  else state.odometerHistory.push({ date: today(), km: value });
  state.odometerHistory = state.odometerHistory.slice(-60);
  saveState();
});
$('#addMaintenanceButton').addEventListener('click', () => openMaintenance());
$('#maintenanceForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  const intervalKm = Number($('#intervalKm').value || 0), intervalMonths = Number($('#intervalMonths').value || 0), lastKm = Number($('#lastKm').value);
  if ((!intervalKm && !intervalMonths) || lastKm > state.bike.currentKm) { event.preventDefault(); $('#maintenanceError').textContent = !intervalKm && !intervalMonths ? 'Informe um intervalo em km ou meses.' : 'A km da última troca não pode superar a km atual.'; return; }
  const cost = Math.max(0, Number($('#itemCost').value || 0));
  const previous = state.maintenance.find(x => x.id === $('#maintenanceId').value);
  const value = { id: $('#maintenanceId').value || uid(), name: $('#itemName').value.trim(), lastKm, intervalKm, lastDate: $('#lastDate').value, intervalMonths, icon: previous?.icon || '🔧', firstKm: previous?.firstKm, firstMonths: previous?.firstMonths, historyUnknown: false, cost };
  const changed = !previous || previous.lastKm !== lastKm || previous.lastDate !== value.lastDate || Number(previous.cost || 0) !== cost;
  if (changed) state.serviceLog.push({ id: uid(), name: value.name, date: value.lastDate, km: lastKm, cost });
  const index = state.maintenance.findIndex(item => item.id === value.id); index >= 0 ? state.maintenance[index] = value : state.maintenance.push(value); saveState();
});
$('#deleteMaintenanceButton').addEventListener('click', () => { if (confirm('Excluir esta manutenção?')) { state.maintenance = state.maintenance.filter(item => item.id !== $('#maintenanceId').value); $('#maintenanceDialog').close(); saveState(); } });
$('#settingsButton').addEventListener('click', () => { $('#bikeNameInput').value = state.bike.name; $('#bikeYearInput').value = state.bike.year; $('#unknownHistorySettings').checked = Boolean(state.bike.historyUnknown); $('#notificationsInput').checked = Boolean(state.notificationsOn); $('#settingsDialog').showModal(); });
$('#settingsForm').addEventListener('submit', event => { if (event.submitter?.value === 'cancel') return; state.bike.name = $('#bikeNameInput').value.trim(); state.bike.year = $('#bikeYearInput').value; state.bike.historyUnknown = $('#unknownHistorySettings').checked; state.notificationsOn = $('#notificationsInput').checked; saveState(); });
$('#notificationsInput').addEventListener('change', event => {
  if (!event.target.checked || !('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
});
$('#confirmDeliveryReviewButton').addEventListener('click', () => {
  const inspected = new Set(['Óleo do motor', 'Revisão periódica', 'Inspeção dos freios', 'Inspeção dos pneus', 'Corrente: limpar, lubrificar e ajustar']);
  state.maintenance.forEach(item => {
    if (inspected.has(item.name)) { item.lastKm = state.bike.currentKm; item.lastDate = today(); item.historyUnknown = false; }
    else if (Number(item.lastKm) === 0) item.historyUnknown = true;
  });
  state.bike.historyUnknown = false;
  state.bike.deliveryReviewKm = state.bike.currentKm;
  state.bike.deliveryReviewDate = today();
  state.serviceLog.push({ id: uid(), name: 'Revisão de entrada (entrega)', date: today(), km: state.bike.currentKm, cost: 0 });
  saveState();
});
$('#exportButton').addEventListener('click', () => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type:'application/json' })); link.download = `moto-em-dia-${today()}.json`; link.click(); URL.revokeObjectURL(link.href); });
$('#importInput').addEventListener('change', async event => { try { const data = JSON.parse(await event.target.files[0].text()); if (!data?.bike || !Array.isArray(data.maintenance)) throw new Error(); if (!data.bike.id) data.bike.id = uid(); data.odometerHistory = Array.isArray(data.odometerHistory) ? data.odometerHistory : []; data.serviceLog = Array.isArray(data.serviceLog) ? data.serviceLog : []; data.roster = Array.isArray(data.roster) ? data.roster : []; data.inspection = data.inspection || null; data.notificationsOn = Boolean(data.notificationsOn); data.scheduleVersion = data.scheduleVersion || 'mottu-sport-2026'; state = data; saveState(); $('#settingsDialog').close(); } catch { alert('Arquivo de backup inválido.'); } event.target.value = ''; });
document.querySelectorAll('dialog .close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));

// --- Inspeção condicional (checklist) ---
$('#openInspectionButton').addEventListener('click', () => {
  const checks = state.inspection?.checks || {};
  document.querySelectorAll('#inspectionForm [name="chk"]').forEach(input => { input.checked = Boolean(checks[input.value]); });
  $('#inspectionError').textContent = '';
  $('#inspectionDialog').showModal();
});
$('#inspectionForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  const checks = {};
  document.querySelectorAll('#inspectionForm [name="chk"]:checked').forEach(input => { checks[input.value] = true; });
  if (!Object.keys(checks).length) { event.preventDefault(); $('#inspectionError').textContent = 'Marque ao menos um item verificado.'; return; }
  state.inspection = { date: today(), km: state.bike.currentKm, checks };
  saveState();
});
$('#clearInspectionButton').addEventListener('click', () => { state.inspection = null; saveState(); $('#inspectionDialog').close(); });

// --- Garagem (multi-moto por troca de snapshot) ---
const bikeSnapshot = () => ({ bike: state.bike, odometerHistory: state.odometerHistory, scheduleVersion: state.scheduleVersion, serviceLog: state.serviceLog, inspection: state.inspection, maintenance: state.maintenance });
const applyBikeSnapshot = snap => { state.bike = snap.bike; state.odometerHistory = Array.isArray(snap.odometerHistory) ? snap.odometerHistory : []; state.scheduleVersion = snap.scheduleVersion || 'mottu-sport-2026'; state.serviceLog = Array.isArray(snap.serviceLog) ? snap.serviceLog : []; state.inspection = snap.inspection || null; state.maintenance = Array.isArray(snap.maintenance) ? snap.maintenance : defaultState().maintenance; };

function renderGarage() {
  const list = $('#bikesList');
  const rows = [{ bike: state.bike, active: true, index: -1 }, ...state.roster.map((snap, index) => ({ bike: snap.bike, active: false, index }))];
  list.innerHTML = rows.map(row => `
    <article class="bike-row ${row.active ? 'active' : ''}">
      <div><strong>${escapeHtml(row.bike.name)}${row.bike.year ? ` · ${escapeHtml(String(row.bike.year))}` : ''}</strong><span>${formatNumber(row.bike.currentKm)} km${row.active ? ' • ativa' : ''}</span></div>
      <div class="bike-row-actions">${row.active ? '' : `<button type="button" data-switch="${row.index}">Usar</button><button type="button" class="remove" data-remove="${row.index}">✕</button>`}</div>
    </article>`).join('');
  list.querySelectorAll('[data-switch]').forEach(button => button.addEventListener('click', () => switchBike(Number(button.dataset.switch))));
  list.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => removeBike(Number(button.dataset.remove))));
}

function switchBike(index) {
  const target = state.roster[index];
  if (!target?.bike) return;
  const current = bikeSnapshot();
  state.roster.splice(index, 1);
  applyBikeSnapshot(target);
  state.roster.push(current);
  notifiedThisSession.clear();
  saveState();
  $('#bikesDialog').close();
}

function removeBike(index) {
  const target = state.roster[index];
  if (!target?.bike || !confirm(`Excluir "${target.bike.name}" e todos os dados dela?`)) return;
  state.roster.splice(index, 1);
  saveState();
  renderGarage();
}

$('#bikesButton').addEventListener('click', () => { renderGarage(); $('#bikesDialog').showModal(); });
$('#newBikeButton').addEventListener('click', () => { $('#bikesDialog').close(); $('#newBikeForm').reset(); $('#newBikeError').textContent = ''; $('#newBikeDialog').showModal(); });
$('#newBikeForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  const name = $('#newBikeName').value.trim(), currentKm = Number($('#newBikeKm').value);
  if (!name || !Number.isFinite(currentKm) || currentKm < 0) { event.preventDefault(); $('#newBikeError').textContent = 'Informe o nome e uma quilometragem válida.'; return; }
  const fresh = defaultState();
  fresh.bike = { id: uid(), name, year: $('#newBikeYear').value, currentKm, historyUnknown: true };
  fresh.odometerHistory = currentKm > 0 ? [{ date: today(), km: currentKm }] : [];
  state.roster.push(bikeSnapshot());
  applyBikeSnapshot(fresh);
  notifiedThisSession.clear();
  saveState();
});

// --- Exportar CSV ---
$('#csvButton').addEventListener('click', () => {
  const rows = [['Tipo', 'Data', 'Km', 'Item', 'IntervaloKm', 'Status', 'Custo']];
  state.maintenance.forEach(item => { const status = maintenanceStatus(item); rows.push(['plano', '', String(item.lastKm), item.name, String(item.intervalKm), status.status, Number(item.cost) > 0 ? String(item.cost) : '']); });
  state.serviceLog.forEach(entry => rows.push(['serviço', String(entry.date || ''), String(entry.km), entry.name, '', '', Number(entry.cost) > 0 ? String(entry.cost) : '']));
  const csv = '\ufeff' + rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `onront-manutencao-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

// --- Compartilhar resumo ---
$('#shareButton').addEventListener('click', async () => {
  const counts = { ok: 0, warning: 0, overdue: 0 };
  state.maintenance.forEach(item => { counts[maintenanceStatus(item).status]++; });
  const next = state.maintenance.map(item => ({ item, data: maintenanceStatus(item) })).sort((a, b) => b.data.progress - a.data.progress).slice(0, 3);
  const text = [
    `ONRONT — ${state.bike.name}${state.bike.year ? ` (${state.bike.year})` : ''}`,
    `${formatNumber(state.bike.currentKm)} km · ${counts.ok} em dia, ${counts.warning} atenção, ${counts.overdue} vencidas`,
    ...next.map(({ item, data }) => `• ${item.name}: ${data.reason}`)
  ].join('\n');
  if (navigator.share) { try { await navigator.share({ title: 'ONRONT Manutenções', text }); return; } catch { /* compartilhamento cancelado */ } }
  try { await navigator.clipboard.writeText(text); alert('Resumo copiado para a área de transferência.'); } catch { alert(text); }
});

// --- Ordem de serviço (impressão / PDF) ---
$('#printOrderButton').addEventListener('click', () => {
  const order = { overdue: 0, warning: 1, ok: 2 };
  const analyzed = state.maintenance.map(item => ({ item, data: maintenanceStatus(item) }));
  const counts = { ok: 0, warning: 0, overdue: 0 };
  analyzed.forEach(({ data }) => { counts[data.status]++; });
  const sorted = [...analyzed].sort((a, b) => order[a.data.status] - order[b.data.status]);
  const recent = [...state.serviceLog].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8);
  $('#serviceOrder').innerHTML = `
    <div class="so-header">
      <div><h1>ONRONT Manutenções — Ordem de serviço</h1><p>Plano Mottu Sport ESD · revisão 2026</p></div>
      <div><strong>${formatDate(new Date())}</strong></div>
    </div>
    <div class="so-meta">
      <div><strong>Moto:</strong> ${escapeHtml(state.bike.name)}${state.bike.year ? ` · ${escapeHtml(String(state.bike.year))}` : ''}</div>
      <div><strong>Quilometragem:</strong> ${formatNumber(state.bike.currentKm)} km</div>
      <div><strong>Situação:</strong> ${counts.ok} em dia · ${counts.warning} atenção · ${counts.overdue} vencidas</div>
      <div><strong>Serviços registrados:</strong> ${state.serviceLog.length}</div>
    </div>
    <h2>Itens de manutenção</h2>
    <table><thead><tr><th>Item</th><th>Status</th><th>Uso do ciclo</th><th>Próxima referência</th></tr></thead><tbody>
      ${sorted.map(({ item, data }) => `<tr><td>${escapeHtml(item.name)}</td><td>${data.status === 'overdue' ? 'VENCIDO' : data.status === 'warning' ? 'ATENÇÃO' : 'Em dia'}</td><td>${Math.round(data.progress)}%</td><td>${escapeHtml(data.next)}</td></tr>`).join('')}
    </tbody></table>
    <h2>Serviços recentes</h2>
    ${recent.length ? `<table><thead><tr><th>Data</th><th>Item</th><th>Km</th><th>Custo</th></tr></thead><tbody>
      ${recent.map(entry => `<tr><td>${entry.date ? escapeHtml(formatDate(new Date(`${entry.date}T12:00:00`))) : '—'}</td><td>${escapeHtml(entry.name)}</td><td>${formatNumber(entry.km)}</td><td>${Number(entry.cost) > 0 ? formatMoney(Number(entry.cost)) : '—'}</td></tr>`).join('')}
    </tbody></table>` : '<p>Nenhum serviço registrado.</p>'}
    <div class="so-sign"><div>Assinatura do responsável</div><div>Carimbo da oficina</div></div>
    <p class="so-foot">Documento gerado pelo ONRONT Manutenções. Desgaste, uso severo e poeira podem exigir antecipação dos intervalos.</p>`;
  $('#settingsDialog').close();
  window.print();
});

initBikeViewer();
render();
if (state.notificationsOn) checkNotifications();
setInterval(checkNotifications, 5 * 60 * 1000);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));

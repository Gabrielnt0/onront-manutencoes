const STORAGE_KEY = 'moto-em-dia-v1';
const DAY = 86400000;
const SCHEDULE_VERSION = 'mottu-sport-2026';

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const readDate = key => new Date(`${key}T12:00:00`);
const today = () => dateKey(new Date());
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const defaultTheme = () => matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
const validDateKey = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = readDate(value);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
};
const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const cleanList = value => Array.isArray(value) ? value.filter(isRecord) : [];
const numberOr = (value, fallback = 0) => {
  const number = Number(value);
  return value === '' || value == null || !Number.isFinite(number) ? fallback : number;
};
const nonNegative = (value, fallback = 0) => Math.max(0, numberOr(value, fallback));
const optionalNumber = value => {
  const number = numberOr(value, NaN);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const normalizeHistory = value => cleanList(value)
  .filter(reading => validDateKey(reading.date) && Number.isFinite(Number(reading.km)) && Number(reading.km) >= 0)
  .map(reading => ({ date: reading.date, km: Number(reading.km) }))
  .sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
const normalizeMaintenance = value => cleanList(value).map(item => ({
  ...item,
  id: item.id || uid(),
  name: String(item.name || '').trim() || 'Manutenção',
  lastKm: nonNegative(item.lastKm),
  lastDate: validDateKey(item.lastDate) ? item.lastDate : today(),
  intervalKm: nonNegative(item.intervalKm),
  intervalMonths: nonNegative(item.intervalMonths),
  firstKm: optionalNumber(item.firstKm),
  firstMonths: optionalNumber(item.firstMonths),
  icon: typeof item.icon === 'string' ? item.icon : '🔧',
  cost: nonNegative(item.cost),
  historyUnknown: Boolean(item.historyUnknown)
}));
const defaultTires = () => ({
  front: { startKm: null, startDate: '', lifeKm: 15000 },
  rear: { startKm: null, startDate: '', lifeKm: 12000 }
});
const normalizeTires = data => {
  const base = defaultTires();
  data.tires = isRecord(data.tires) ? data.tires : {};
  ['front', 'rear'].forEach(position => {
    const raw = isRecord(data.tires[position]) ? data.tires[position] : {};
    const startKm = raw.startKm === '' || raw.startKm == null ? null : Number(raw.startKm);
    const startDate = validDateKey(raw.startDate) ? raw.startDate : '';
    data.tires[position] = {
      startKm: Number.isFinite(startKm) && startKm >= 0 ? startKm : null,
      startDate,
      lifeKm: Number(raw.lifeKm) > 0 ? Number(raw.lifeKm) : base[position].lifeKm
    };
  });
  return data;
};
const maintenancePresets = [
  ['Óleo do motor', 5000, 3, '🛢️', 1000, 1], ['Revisão periódica', 5000, 3, '🔍', 1000, 1],
  ['Inspeção dos freios', 5000, 3, '🛑', 1000, 1], ['Inspeção dos pneus', 5000, 3, '◉', 1000, 1],
  ['Corrente: limpar, lubrificar e ajustar', 5000, 3, '⛓️', 1000, 1], ['Filtro de ar', 12000, 0, '🌬️', 12000, 0],
  ['Vela de ignição', 12000, 0, '⚡', 12000, 0], ['Óleo da bengala dianteira', 18000, 0, '🔧', 18000, 0],
  ['Filtro de combustível', 24000, 0, '⛽', 24000, 0]
];
const defaultMaintenance = () => maintenancePresets.map(([name, intervalKm, intervalMonths, icon, firstKm, firstMonths]) => ({
  id: uid(), name, intervalKm, intervalMonths, firstKm, firstMonths, lastKm: 0, lastDate: today(), icon
}));
const scheduleUpgrades = {
  'Óleo do motor': ['Óleo do motor', 5000, 3, 1000, 1],
  'Pastilhas de freio': ['Inspeção dos freios', 5000, 3, 1000, 1],
  'Pneus': ['Inspeção dos pneus', 5000, 3, 1000, 1],
  'Relação e corrente': ['Corrente: limpar, lubrificar e ajustar', 5000, 3, 1000, 1],
  'Filtro de ar': ['Filtro de ar', 12000, 0, 12000, 0],
  'Vela de ignição': ['Vela de ignição', 12000, 0, 12000, 0]
};
function upgradeSchedule(data, version) {
  if (version === SCHEDULE_VERSION) return;
  data.maintenance.forEach(item => {
    const upgrade = scheduleUpgrades[item.name];
    if (upgrade) [item.name, item.intervalKm, item.intervalMonths, item.firstKm, item.firstMonths] = upgrade;
  });
  const present = new Set(data.maintenance.map(item => item.name));
  defaultMaintenance().filter(item => !present.has(item.name)).forEach(item => data.maintenance.push(item));
  data.scheduleVersion = SCHEDULE_VERSION;
}
const defaultState = () => normalizeTires({
  bike: { id: uid(), name: 'TVS Sport', year: '', currentKm: 0, historyUnknown: false },
  odometerHistory: [],
  scheduleVersion: SCHEDULE_VERSION,
  serviceLog: [],
  inspection: null,
  notificationsOn: false,
  roster: [],
  fuelLog: [],
  ui: { theme: defaultTheme(), lang: 'pt' },
  push: { enabled: false, vapid: '', endpoint: '' },
  signature: null,
  maintenance: defaultMaintenance()
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
let bikeFocus = null;
const notifiedThisSession = new Set();

const I18N = {
  en: {
    'ONRONT MANUTENÇÕES': 'ONRONT MAINTENANCE', 'Garagem: trocar de moto': 'Garage: switch bike',
    'Editar dados da moto': 'Edit bike details', 'Quilometragem atual': 'Current mileage',
    'Atualizar km': 'Update km', 'Em dia': 'On track', 'Atenção': 'Attention', 'Vencidas': 'Overdue',
    'ASSISTENTE PREVENTIVO': 'PREVENTIVE ASSISTANT', 'Previsão inteligente': 'Smart forecast',
    'Ritmo de uso': 'Usage rate', 'Aprendendo': 'Learning', 'Próximo marco': 'Next milestone',
    'VENCIDO': 'OVERDUE', 'ATENÇÃO': 'ATTENTION',
    'Revisão periódica': 'Periodic service', 'Inspeção dos freios': 'Brake inspection', 'Inspeção dos pneus': 'Tire inspection',
    'Corrente: limpar, lubrificar e ajustar': 'Chain: clean, lubricate and adjust', 'Óleo da bengala dianteira': 'Fork oil',
    'Filtro de combustível': 'Fuel filter', 'Vela de ignição': 'Spark plug', 'Histórico desconhecido': 'Unknown history',
    'dias': 'days', 'km': 'km',
    'Custo acumulado': 'Total cost', 'Serviços registrados': 'Services logged', 'Custo por km': 'Cost per km',
    'Consumo médio': 'Average consumption', 'Gráfico de uso do hodômetro': 'Odometer usage chart',
    'GUIA VISUAL': 'VISUAL GUIDE', 'Explore sua moto': 'Explore your bike', 'Modelo 3D interativo': 'Interactive 3D model',
    'Esquerda': 'Left', 'Frente': 'Front', 'Direita': 'Right', 'Traseira': 'Rear',
    'Toque em uma peça para ampliar • toque de novo para voltar': 'Tap a part to zoom in • tap again to go back',
    'Toque em um ponto': 'Tap a marker', 'Veja onde ficam os principais itens de manutenção.': 'See where the main maintenance items are.',
    'Representação visual aproximada.': 'Approximate visual representation.', 'Uso estimado': 'Estimated wear',
    'PRÓXIMOS CUIDADOS': 'UPCOMING', 'Manutenções': 'Maintenance', '+ Adicionar': '+ Add',
    'Nenhuma inspeção registrada': 'No inspection recorded', 'Verifique freios, pneus, corrente e luzes': 'Check brakes, tires, chain and lights',
    'Checklist': 'Checklist', 'Última inspeção:': 'Last inspection:', 'itens verificados': 'items checked',
    'LIVRO DE SERVIÇO': 'SERVICE BOOK', 'Histórico': 'History', 'registro': 'record', 'registros': 'records',
    'Nenhum serviço registrado. Ao editar uma manutenção, o registro entra aqui.': 'No services yet. Edit a maintenance item to create a record.',
    'COMBUSTÍVEL': 'FUEL', 'Abastecimentos': 'Fuel-ups', '+ Registrar': '+ Log',
    'Nenhum abastecimento registrado.': 'No fuel-ups recorded.',
    'COMPROVANTES': 'RECEIPTS', 'Anexos': 'Attachments', '+ Anexar': '+ Attach',
    'Nenhum anexo. Use + Anexar para guardar fotos ou notas fiscais.': 'No attachments. Use + Attach to save photos or receipts.',
    'Próxima:': 'Next:', 'Uso do ciclo:': 'Cycle use:', 'Nenhuma manutenção cadastrada.': 'No maintenance items yet.',
    'Gráfico de uso disponível após 2 leituras de hodômetro em dias diferentes.': 'Chart available after 2 odometer readings on different days.',
    'leituras': 'readings', 'km/dia': 'km/day', 'Ritmo em aprendizado': 'Learning pace',
    'km restantes': 'km remaining', 'Faltam': 'Only', 'km atrasado': 'km overdue', 'dias atrasado': 'days overdue',
    'Dados da moto': 'Bike details', 'Nome da moto': 'Bike name', 'Ano (opcional)': 'Year (optional)',
    'Histórico de manutenção ainda desconhecido': 'Maintenance history still unknown',
    'Ativar lembretes de manutenção': 'Enable maintenance reminders', 'Ativar push remoto (Web Push)': 'Enable remote push (Web Push)',
    'Tema': 'Theme', 'Escuro': 'Dark', 'Claro': 'Light', 'Idioma': 'Language', 'Português': 'Portuguese',
    'Chave pública VAPID (opcional)': 'VAPID public key (optional)',
    'Salvar dados': 'Save details', 'Exportar backup (JSON)': 'Export backup (JSON)', 'Exportar planilha (CSV)': 'Export spreadsheet (CSV)',
    'Exportar calendário (.ics)': 'Export calendar (.ics)', 'Gerar link de sincronização': 'Generate sync link',
    'Aplicar link de sincronização': 'Apply sync link', 'Assinar ordem de serviço': 'Sign work order',
    'Compartilhar resumo': 'Share summary', 'Gerar ordem de serviço': 'Generate work order', 'Importar backup': 'Import backup',
    'Nova manutenção': 'New maintenance', 'Editar manutenção': 'Edit maintenance', 'Item': 'Item',
    'Última troca (km)': 'Last change (km)', 'Intervalo (km)': 'Interval (km)', 'Última troca': 'Last change',
    'Intervalo (meses)': 'Interval (months)', 'Custo (R$, opcional)': 'Cost (R$, optional)',
    'Salvar manutenção': 'Save maintenance', 'Excluir manutenção': 'Delete maintenance',
    'Atualizar quilometragem': 'Update mileage', 'Salvar quilometragem': 'Save mileage',
    'Inspeção geral': 'General inspection', 'Salvar inspeção': 'Save inspection', 'Limpar registro': 'Clear record',
    'Garagem': 'Garage', '+ Nova moto': '+ New bike', 'Nova moto': 'New bike', 'Criar moto': 'Create bike',
    'Registrar abastecimento': 'Log fuel-up', 'Data': 'Date', 'Quilometragem': 'Mileage', 'Litros': 'Liters',
    'Valor total (R$)': 'Total amount (R$)', 'Posto (opcional)': 'Station (optional)',
    'Salvar abastecimento': 'Save fuel-up', 'Excluir registro': 'Delete record',
    'Anexar comprovante': 'Attach receipt', 'Serviço relacionado (opcional)': 'Related service (optional)',
    'Descrição': 'Description', 'Salvar anexo': 'Save attachment',
    'Sincronização por link': 'Sync by link', 'Aplicar dados do link': 'Apply link data', 'Copiar link gerado': 'Copy generated link',
    'Assinatura do responsável': 'Signature of responsible person', 'Assinar': 'Sign', 'Limpar': 'Clear',
    'Salvar assinatura': 'Save signature',
    'DIÁRIO DE USO': 'USAGE LOG', 'Calendário de km': 'Mileage calendar', '+ Registrar hoje': '+ Log today',
    'Seg': 'Mon', 'Ter': 'Tue', 'Qua': 'Wed', 'Qui': 'Thu', 'Sex': 'Fri', 'Sáb': 'Sat', 'Dom': 'Sun',
    'leitura': 'reading', 'estimativa': 'estimate', 'manutenção prevista': 'service due',
    'Próximas manutenções': 'Upcoming maintenance',
    'Registre o hodômetro por dia: a diferença entre leituras vira os km rodados de cada dia. A previsão usa seu ritmo médio.': 'Log the odometer daily: the difference between readings becomes that day’s mileage. Forecasts use your average pace.',
    'Leitura do dia —': 'Reading for —', 'Hodômetro neste dia': 'Odometer on this day', 'Salvar leitura': 'Save reading', 'Excluir leitura': 'Delete reading',
    'PNEUS ORIGINAIS MOTTU': 'ORIGINAL MOTTU TIRES', 'Desgaste dos pneus': 'Tire wear', 'Ajustar pneus': 'Adjust tires',
    'Informe a km de instalação dos pneus para ver a estimativa.': 'Enter the tire installation mileage to see the estimate.',
    'Substituir agora': 'Replace now', 'Planejar troca': 'Plan replacement', 'Em uso': 'In use', 'Previsão:': 'Forecast:',
    'Ritmo de uso ainda em aprendizado': 'Usage pace still learning', 'Pneu dianteiro': 'Front tire', 'Pneu traseiro': 'Rear tire',
    'Pneu:': 'Tire:', 'Dianteiro': 'Front', 'Traseiro': 'Rear', 'Registrar troca hoje': 'Log replacement today',
    'Km na instalação': 'Installation mileage', 'Data da instalação': 'Installation date', 'Vida útil estimada (km)': 'Estimated life (km)',
    'Informe km de instalação até a km atual e vida útil maior que zero.': 'Enter installation mileage up to the current km and a life greater than zero.',
    'A estimativa usa a km desde a instalação e a vida útil informada. Confira os sulcos e o indicador TWI: não substitui inspeção física.': 'The estimate uses mileage since installation and the informed life. Check tread grooves and the TWI marker: it does not replace a physical inspection.',
    'Valores iniciais são referência geral, não especificação oficial da Mottu.': 'Initial values are a general reference, not an official Mottu specification.',
    'Deixe a km de instalação em branco se não souber. Você também pode registrar a troca no dia em que ela acontecer.': 'Leave installation mileage blank if you do not know it. You can also log the replacement on the day it happens.',
    'Arraste para girar • pinça/roda para zoom • toque em uma peça para ampliar • toque de novo para voltar': 'Drag to rotate • pinch/scroll to zoom • tap a part to zoom in • tap again to go back',
    'Modelo 3D interativo da TVS Sport. Use setas para girar, Page Up/Page Down para escolher peças, + ou - para zoom, Home para sair da peça.': 'Interactive 3D model of the TVS Sport. Use arrow keys to rotate, Page Up/Page Down to choose parts, + or - to zoom, Home to clear the selection.',
    'Motor': 'Engine', 'Óleo do motor': 'Engine oil', 'Corrente': 'Chain', 'Freio dianteiro': 'Front brake',
    'Suspensão dianteira': 'Front suspension', 'Suspensão traseira': 'Rear suspension', 'Filtro de ar': 'Air filter',
    'Farol': 'Headlight', 'Escapamento': 'Exhaust', 'Lanterna e piscas': 'Taillight and turn signals',
    'Observe vazamentos, ruídos diferentes, dificuldade de partida ou perda de força.': 'Watch for leaks, unusual noises, hard starts or loss of power.',
    'Não abra o motor sem conhecimento técnico.': 'Do not open the engine without technical knowledge.',
    'Confira o nível com a moto vertical, em piso plano e conforme o procedimento do manual.': 'Check the level with the bike upright, on level ground and following the manual procedure.',
    'Motor quente e óleo usado podem causar queimaduras.': 'A hot engine and used oil can cause burns.',
    'Verifique limpeza, lubrificação e folga. A Mottu indica limite de 20–30 mm.': 'Check cleanliness, lubrication and slack. Mottu indicates a 20–30 mm limit.',
    'Nunca inspecione com o motor ligado.': 'Never inspect with the engine running.',
    'Observe disco, pinça, resposta da manete e sinais de desgaste ou vazamento.': 'Check the disc, caliper, lever response and signs of wear or leakage.',
    'Freios são item crítico; procure uma oficina em caso de dúvida.': 'Brakes are critical; see a workshop if in doubt.',
    'Verifique pressão a frio, cortes, objetos presos e indicador TWI.': 'Check cold pressure, cuts, embedded objects and the TWI marker.',
    'Não pilote com bolhas, cortes profundos ou lona aparente.': 'Do not ride with blisters, deep cuts or exposed cords.',
    'Verifique pressão a frio, desgaste central, cortes e indicador TWI.': 'Check cold pressure, center wear, cuts and the TWI marker.',
    'Procure óleo nas bengalas, batidas secas, folga ou retorno irregular.': 'Look for oil on the forks, dry knocks, play or uneven rebound.',
    'Reparo exige ferramentas e procedimento correto.': 'Repair requires the right tools and procedure.',
    'Observe vazamentos, molas danificadas, fixações e comportamento em irregularidades.': 'Check leaks, damaged springs, mounts and behavior on rough roads.',
    'Não desmonte o amortecedor sob carga.': 'Do not disassemble the shock absorber under load.',
    'Fica sob a carenagem lateral. Em locais empoeirados, pode precisar de atenção antecipada.': 'It sits under the side fairing. In dusty areas it may need earlier attention.',
    'Confirme o acesso e o elemento correto no manual.': 'Confirm access and the correct element in the manual.',
    'Teste luz alta, baixa, alinhamento, lente e conexões visíveis.': 'Test high and low beam, alignment, lens and visible connectors.',
    'Desligue a ignição antes de acessar conectores.': 'Turn off the ignition before accessing connectors.',
    'Observe fixações, corrosão, ruído anormal e possíveis vazamentos.': 'Check mounts, corrosion, abnormal noise and possible leaks.',
    'Espere esfriar completamente antes de tocar.': 'Let it cool completely before touching.',
    'Teste lanterna, luz de freio e ambos os indicadores de direção.': 'Test the taillight, brake light and both turn signals.',
    'Peças elétricas devem ser verificadas com cuidado.': 'Electrical parts must be checked carefully.',
    'Fotos:': 'Photos:', 'confiança': 'confidence',
    'Fotos: esta peça não pode ser avaliada visualmente com segurança.': 'Photos: this part cannot be safely assessed visually.',
    'sem vazamento externo evidente': 'no evident external leak', 'média': 'medium', 'baixa': 'low',
    'visível, mas sem resolução para medir folga ou alongamento': 'visible, but not clear enough to measure slack or stretch',
    'disco visível; espessura da pastilha não mensurável': 'disc visible; pad thickness not measurable',
    'sulcos visíveis, sem corte evidente no ângulo fotografado': 'tread visible, no evident cut in the photographed angle',
    'sulcos visíveis, sem lona ou bolha aparente': 'tread visible, no exposed cord or blister apparent',
    'sem vazamento evidente nas áreas visíveis': 'no evident leak in the visible areas',
    'molas e fixações externas aparentam íntegras': 'springs and external mounts appear intact',
    'lente aparentemente íntegra; funcionamento não confirmado': 'lens apparently intact; operation not confirmed',
    'marcas de uso externas, sem dano estrutural evidente': 'external wear marks, no evident structural damage',
    'lentes aparentemente íntegras; funcionamento não confirmado': 'lenses apparently intact; operation not confirmed',
    'km usados desde a última referência': 'km used since the last reference',
    'Histórico desconhecido: faça uma revisão de entrada antes de confiar nos prazos. Priorize óleo, freios, pneus, corrente, filtro de ar, vela e suspensão.': 'Unknown history: do an intake service before trusting the deadlines. Prioritize oil, brakes, tires, chain, air filter, plug and suspension.',
    'Cadastre uma manutenção para iniciar a análise preventiva.': 'Add a maintenance item to start the preventive analysis.',
    'km/mês': 'km/month', 'Prioridade alta: ': 'High priority: ', ' está vencida. Evite adiar e faça uma inspeção antes de continuar usando a moto.': ' is overdue. Do not delay and inspect it before riding again.',
    'Antecipe ': 'Get ahead of ', ': ': ': ', 'Tudo em dia. O próximo item a acompanhar é ': 'All on track. The next item to watch is ', ', com ': ', with ',
    'No ritmo atual, o assistente projeta os prazos usando ': 'At the current pace, the assistant projects deadlines using ', ' km por dia.': ' km per day.',
    'Atualize o hodômetro em dias diferentes. Após duas leituras, o app aprende seu ritmo e passa a estimar datas.': 'Update the odometer on different days. After two readings, the app learns your pace and starts estimating dates.',
    'Confirmar na ordem de serviço': 'Confirm on the work order', 'confirmar manutenção': 'confirm service', 'dias restantes': 'days remaining',
    'Total gasto': 'Total spent', 'Preço médio': 'Average price', 'Editar': 'Edit', 'ativa': 'active',
    'Leitura anterior:': 'Previous reading:', 'Próxima leitura:': 'Next reading:', 'Primeira leitura do histórico': 'First reading in history',
    'Informe um hodômetro entre a leitura anterior e a próxima.': 'Enter an odometer value between the previous and the next reading.',
    'Excluir esta leitura?': 'Delete this reading?', 'A quilometragem não pode ser menor que a atual.': 'Mileage cannot be lower than the current value.',
    'Leitura automática indisponível neste navegador. Digite os km manualmente.': 'Automatic reading unavailable in this browser. Enter the km manually.',
    'Nenhum número legível. Confirme os km manualmente.': 'No readable number. Confirm the km manually.',
    'Valor lido da foto. Confira antes de salvar.': 'Value read from the photo. Check it before saving.',
    'Não foi possível ler a foto. Digite os km manualmente.': 'Could not read the photo. Enter the km manually.',
    'Informe um intervalo em km ou meses.': 'Enter an interval in km or months.',
    'A km da última troca não pode superar a km atual.': 'The last change km cannot exceed the current mileage.',
    'Excluir esta manutenção?': 'Delete this maintenance item?', 'Marque ao menos um item verificado.': 'Check at least one verified item.',
    'Informe o nome e uma quilometragem válida.': 'Enter a name and a valid mileage.',
    'Informe litros, valor e km válidos (até a km atual).': 'Enter valid liters, amount and km (up to the current mileage).',
    'Escolha um arquivo.': 'Choose a file.', 'Arquivo acima de 8 MB.': 'File over 8 MB.',
    'Não foi possível salvar o anexo.': 'Could not save the attachment.', 'Excluir anexo': 'Delete attachment', 'Excluir este anexo?': 'Delete this attachment?',
    'IndexedDB indisponível.': 'IndexedDB unavailable.', 'Nenhum endpoint de push registrado.': 'No push endpoint registered.',
    'Endpoint registrado:': 'Registered endpoint:', 'Arquivo de backup inválido.': 'Invalid backup file.',
    'Não foi possível gerar o link.': 'Could not generate the link.', 'Link de sincronização inválido.': 'Invalid sync link.',
    'Link copiado. Abra-o em outro dispositivo para transferir os dados.': 'Link copied. Open it on another device to transfer the data.',
    'Resumo copiado para a área de transferência.': 'Summary copied to the clipboard.'
  },
  es: {
    'ONRONT MANUTENÇÕES': 'ONRONT MANTENIMIENTOS', 'Garagem: trocar de moto': 'Garaje: cambiar de moto',
    'Editar dados da moto': 'Editar datos de la moto', 'Quilometragem atual': 'Kilometraje actual',
    'Atualizar km': 'Actualizar km', 'Em dia': 'Al día', 'Atenção': 'Atención', 'Vencidas': 'Vencidas',
    'ASSISTENTE PREVENTIVO': 'ASISTENTE PREVENTIVO', 'Previsão inteligente': 'Previsión inteligente',
    'Ritmo de uso': 'Ritmo de uso', 'Aprendendo': 'Aprendiendo', 'Próximo marco': 'Próximo hito',
    'VENCIDO': 'VENCIDO', 'ATENÇÃO': 'ATENCIÓN',
    'Revisão periódica': 'Revisión periódica', 'Inspeção dos freios': 'Revisión de frenos', 'Inspeção dos pneus': 'Revisión de neumáticos',
    'Corrente: limpar, lubrificar e ajustar': 'Cadena: limpiar, lubricar y ajustar', 'Óleo da bengala dianteira': 'Aceite de la horquilla',
    'Filtro de combustível': 'Filtro de combustible', 'Vela de ignição': 'Bujía', 'Histórico desconhecido': 'Historial desconocido',
    'dias': 'días', 'km': 'km',
    'Custo acumulado': 'Coste acumulado', 'Serviços registrados': 'Servicios registrados', 'Custo por km': 'Coste por km',
    'Consumo médio': 'Consumo medio', 'Gráfico de uso do hodômetro': 'Gráfico de uso del odómetro',
    'GUIA VISUAL': 'GUÍA VISUAL', 'Explore sua moto': 'Explora tu moto', 'Modelo 3D interativo': 'Modelo 3D interactivo',
    'Esquerda': 'Izquierda', 'Frente': 'Delante', 'Direita': 'Derecha', 'Traseira': 'Atrás',
    'Toque em uma peça para ampliar • toque de novo para voltar': 'Toca una pieza para ampliar • toca de nuevo para volver',
    'Toque em um ponto': 'Toca un punto', 'Veja onde ficam os principais itens de manutenção.': 'Mira dónde están los principales mantenimientos.',
    'Representação visual aproximada.': 'Representación visual aproximada.', 'Uso estimado': 'Uso estimado',
    'PRÓXIMOS CUIDADOS': 'PRÓXIMOS CUIDADOS', 'Manutenções': 'Mantenimientos', '+ Adicionar': '+ Añadir',
    'Nenhuma inspeção registrada': 'Sin inspección registrada', 'Verifique freios, pneus, corrente e luzes': 'Revisa frenos, neumáticos, cadena y luces',
    'Checklist': 'Lista de control', 'Última inspeção:': 'Última inspección:', 'itens verificados': 'elementos verificados',
    'LIVRO DE SERVIÇO': 'LIBRO DE SERVICIO', 'Histórico': 'Historial', 'registro': 'registro', 'registros': 'registros',
    'Nenhum serviço registrado. Ao editar uma manutenção, o registro entra aqui.': 'Sin servicios. Edita un mantenimiento para crear un registro.',
    'COMBUSTÍVEL': 'COMBUSTIBLE', 'Abastecimentos': 'Repostajes', '+ Registrar': '+ Registrar',
    'Nenhum abastecimento registrado.': 'Sin repostajes registrados.',
    'COMPROVANTES': 'COMPROBANTES', 'Anexos': 'Adjuntos', '+ Anexar': '+ Adjuntar',
    'Nenhum anexo. Use + Anexar para guardar fotos ou notas fiscais.': 'Sin adjuntos. Usa + Adjuntar para guardar fotos o facturas.',
    'Próxima:': 'Próxima:', 'Uso do ciclo:': 'Uso del ciclo:', 'Nenhuma manutenção cadastrada.': 'Sin mantenimientos registrados.',
    'Gráfico de uso disponível após 2 leituras de hodômetro em dias diferentes.': 'Gráfico disponible tras 2 lecturas del odómetro en días distintos.',
    'leituras': 'lecturas', 'km/dia': 'km/día', 'Ritmo em aprendizado': 'Ritmo en aprendizaje',
    'km restantes': 'km restantes', 'Faltam': 'Quedan', 'km atrasado': 'km atrasado', 'dias atrasado': 'días atrasado',
    'Dados da moto': 'Datos de la moto', 'Nome da moto': 'Nombre de la moto', 'Ano (opcional)': 'Año (opcional)',
    'Histórico de manutenção ainda desconhecido': 'Historial de mantenimiento aún desconocido',
    'Ativar lembretes de manutenção': 'Activar recordatorios de mantenimiento', 'Ativar push remoto (Web Push)': 'Activar push remoto (Web Push)',
    'Tema': 'Tema', 'Escuro': 'Oscuro', 'Claro': 'Claro', 'Idioma': 'Idioma', 'Português': 'Portugués',
    'Chave pública VAPID (opcional)': 'Clave pública VAPID (opcional)',
    'Salvar dados': 'Guardar datos', 'Exportar backup (JSON)': 'Exportar copia (JSON)', 'Exportar planilha (CSV)': 'Exportar hoja (CSV)',
    'Exportar calendário (.ics)': 'Exportar calendario (.ics)', 'Gerar link de sincronización': 'Generar enlace de sincronización',
    'Gerar link de sincronização': 'Generar enlace de sincronización', 'Aplicar link de sincronização': 'Aplicar enlace de sincronización',
    'Assinar ordem de serviço': 'Firmar orden de trabajo', 'Compartilhar resumo': 'Compartir resumen',
    'Gerar ordem de serviço': 'Generar orden de trabajo', 'Importar backup': 'Importar copia',
    'Nova manutenção': 'Nuevo mantenimiento', 'Editar manutenção': 'Editar mantenimiento', 'Item': 'Artículo',
    'Última troca (km)': 'Último cambio (km)', 'Intervalo (km)': 'Intervalo (km)', 'Última troca': 'Último cambio',
    'Intervalo (meses)': 'Intervalo (meses)', 'Custo (R$, opcional)': 'Coste (R$, opcional)',
    'Salvar manutenção': 'Guardar mantenimiento', 'Excluir manutenção': 'Eliminar mantenimiento',
    'Atualizar quilometragem': 'Actualizar kilometraje', 'Salvar quilometragem': 'Guardar kilometraje',
    'Inspeção geral': 'Inspección general', 'Salvar inspeção': 'Guardar inspección', 'Limpar registro': 'Borrar registro',
    'Garagem': 'Garaje', '+ Nova moto': '+ Nueva moto', 'Nova moto': 'Nueva moto', 'Criar moto': 'Crear moto',
    'Registrar abastecimento': 'Registrar repostaje', 'Data': 'Fecha', 'Quilometragem': 'Kilometraje', 'Litros': 'Litros',
    'Valor total (R$)': 'Importe total (R$)', 'Posto (opcional)': 'Estación (opcional)',
    'Salvar abastecimento': 'Guardar repostaje', 'Excluir registro': 'Eliminar registro',
    'Anexar comprovante': 'Adjuntar comprobante', 'Serviço relacionado (opcional)': 'Servicio relacionado (opcional)',
    'Descrição': 'Descripción', 'Salvar anexo': 'Guardar adjunto',
    'Sincronização por link': 'Sincronización por enlace', 'Aplicar dados do link': 'Aplicar datos del enlace',
    'Copiar link gerado': 'Copiar enlace generado', 'Assinatura do responsável': 'Firma del responsable',
    'Assinar': 'Firmar', 'Limpar': 'Limpiar', 'Salvar assinatura': 'Guardar firma',
    'DIÁRIO DE USO': 'REGISTRO DE USO', 'Calendário de km': 'Calendario de kilómetros', '+ Registrar hoje': '+ Registrar hoy',
    'Seg': 'Lun', 'Ter': 'Mar', 'Qua': 'Mié', 'Qui': 'Jue', 'Sex': 'Vie', 'Sáb': 'Sáb', 'Dom': 'Dom',
    'leitura': 'lectura', 'estimativa': 'estimación', 'manutenção prevista': 'mantenimiento previsto',
    'Próximas manutenções': 'Próximos mantenimientos',
    'Registre o hodômetro por dia: a diferença entre leituras vira os km rodados de cada dia. A previsão usa seu ritmo médio.': 'Registra el odómetro cada día: la diferencia entre lecturas son los kilómetros de cada día. Las previsiones usan tu ritmo medio.',
    'Leitura do dia —': 'Lectura del día —', 'Hodômetro neste dia': 'Odómetro de este día', 'Salvar leitura': 'Guardar lectura', 'Excluir leitura': 'Eliminar lectura',
    'PNEUS ORIGINAIS MOTTU': 'NEUMÁTICOS ORIGINALES MOTTU', 'Desgaste dos pneus': 'Desgaste de neumáticos', 'Ajustar pneus': 'Ajustar neumáticos',
    'Informe a km de instalação dos pneus para ver a estimativa.': 'Indica el kilometraje de instalación para ver la estimación.',
    'Substituir agora': 'Sustituir ahora', 'Planejar troca': 'Planificar cambio', 'Em uso': 'En uso', 'Previsão:': 'Previsión:',
    'Ritmo de uso ainda em aprendizado': 'Ritmo de uso aún en aprendizaje', 'Pneu dianteiro': 'Neumático delantero', 'Pneu traseiro': 'Neumático trasero',
    'Pneu:': 'Neumático:', 'Dianteiro': 'Delantero', 'Traseiro': 'Trasero', 'Registrar troca hoje': 'Registrar cambio hoy',
    'Km na instalação': 'Km en la instalación', 'Data da instalação': 'Fecha de instalación', 'Vida útil estimada (km)': 'Vida útil estimada (km)',
    'Informe km de instalação até a km atual e vida útil maior que zero.': 'Indica km de instalación hasta el km actual y una vida útil mayor que cero.',
    'A estimativa usa a km desde a instalação e a vida útil informada. Confira os sulcos e o indicador TWI: não substitui inspeção física.': 'La estimación usa el km desde la instalación y la vida útil indicada. Revisa los surcos y el indicador TWI: no sustituye una inspección física.',
    'Valores iniciais são referência geral, não especificação oficial da Mottu.': 'Los valores iniciales son una referencia general, no una especificación oficial de Mottu.',
    'Deixe a km de instalação em branco se não souber. Você também pode registrar a troca no dia em que ela acontecer.': 'Deja el km de instalación en blanco si no lo sabes. También puedes registrar el cambio el día en que ocurra.',
    'Arraste para girar • pinça/roda para zoom • toque em uma peça para ampliar • toque de novo para voltar': 'Arrastra para girar • pellizca/rueda para acercar • toca una pieza para ampliar • toca de nuevo para volver',
    'Modelo 3D interativo da TVS Sport. Use setas para girar, Page Up/Page Down para escolher peças, + ou - para zoom, Home para sair da peça.': 'Modelo 3D interactivo de la TVS Sport. Usa las flechas para girar, Page Up/Page Down para elegir piezas, + o - para acercar y Home para salir de la pieza.',
    'Motor': 'Motor', 'Óleo do motor': 'Aceite del motor', 'Corrente': 'Cadena', 'Freio dianteiro': 'Freno delantero',
    'Suspensão dianteira': 'Suspensión delantera', 'Suspensão traseira': 'Suspensión trasera', 'Filtro de ar': 'Filtro de aire',
    'Farol': 'Farola', 'Escapamento': 'Escape', 'Lanterna e piscas': 'Piloto e intermitentes',
    'Observe vazamentos, ruídos diferentes, dificuldade de partida ou perda de força.': 'Observa fugas, ruidos distintos, dificultad de arranque o pérdida de fuerza.',
    'Não abra o motor sem conhecimento técnico.': 'No abras el motor sin conocimientos técnicos.',
    'Confira o nível com a moto vertical, em piso plano e conforme o procedimento do manual.': 'Comprueba el nivel con la moto vertical, en suelo llano y siguiendo el procedimiento del manual.',
    'Motor quente e óleo usado podem causar queimaduras.': 'El motor caliente y el aceite usado pueden causar quemaduras.',
    'Verifique limpeza, lubrificação e folga. A Mottu indica limite de 20–30 mm.': 'Revisa limpieza, lubricación y holgura. Mottu indica un límite de 20–30 mm.',
    'Nunca inspecione com o motor ligado.': 'Nunca inspecciones con el motor encendido.',
    'Observe disco, pinça, resposta da manete e sinais de desgaste ou vazamento.': 'Observa disco, pinza, respuesta de la maneta y signos de desgaste o fuga.',
    'Freios são item crítico; procure uma oficina em caso de dúvida.': 'Los frenos son críticos; acude a un taller si tienes dudas.',
    'Verifique pressão a frio, cortes, objetos presos e indicador TWI.': 'Verifica presión en frío, cortes, objetos clavados e indicador TWI.',
    'Não pilote com bolhas, cortes profundos ou lona aparente.': 'No conduzcas con ampollas, cortes profundos o cordaje visible.',
    'Verifique pressão a frio, desgaste central, cortes e indicador TWI.': 'Verifica presión en frío, desgaste central, cortes e indicador TWI.',
    'Procure óleo nas bengalas, batidas secas, folga ou retorno irregular.': 'Busca aceite en las horquillas, golpes secos, holgura o retorno irregular.',
    'Reparo exige ferramentas e procedimento correto.': 'La reparación exige herramientas y procedimiento correcto.',
    'Observe vazamentos, molas danificadas, fixações e comportamento em irregularidades.': 'Observa fugas, muelles dañados, anclajes y comportamiento en irregularidades.',
    'Não desmonte o amortecedor sob carga.': 'No desmontes el amortiguador bajo carga.',
    'Fica sob a carenagem lateral. Em locais empoeirados, pode precisar de atenção antecipada.': 'Está bajo el carenado lateral. En lugares polvorientos puede necesitar atención anticipada.',
    'Confirme o acesso e o elemento correto no manual.': 'Confirma el acceso y el elemento correcto en el manual.',
    'Teste luz alta, baixa, alinhamento, lente e conexões visíveis.': 'Prueba luz alta, baja, alineación, lente y conexiones visibles.',
    'Desligue a ignição antes de acessar conectores.': 'Apaga el encendido antes de acceder a los conectores.',
    'Observe fixações, corrosão, ruído anormal e possíveis vazamentos.': 'Observa anclajes, corrosión, ruido anormal y posibles fugas.',
    'Espere esfriar completamente antes de tocar.': 'Espera a que se enfríe por completo antes de tocar.',
    'Teste lanterna, luz de freio e ambos os indicadores de direção.': 'Prueba piloto, luz de freno y ambos intermitentes.',
    'Peças elétricas devem ser verificadas com cuidado.': 'Las piezas eléctricas deben revisarse con cuidado.',
    'Fotos:': 'Fotos:', 'confiança': 'confianza',
    'Fotos: esta peça não pode ser avaliada visualmente com segurança.': 'Fotos: esta pieza no puede evaluarse visualmente con seguridad.',
    'sem vazamento externo evidente': 'sin fuga externa evidente', 'média': 'media', 'baixa': 'baja',
    'visível, mas sem resolução para medir folga ou alongamento': 'visible, pero sin resolución para medir holgura o estiramiento',
    'disco visível; espessura da pastilha não mensurável': 'disco visible; grosor de la pastilla no medible',
    'sulcos visíveis, sem corte evidente no ângulo fotografado': 'surcos visibles, sin corte evidente en el ángulo fotografiado',
    'sulcos visíveis, sem lona ou bolha aparente': 'surcos visibles, sin cordaje ni ampolla aparente',
    'sem vazamento evidente nas áreas visíveis': 'sin fuga evidente en las áreas visibles',
    'molas e fixações externas aparentam íntegras': 'muelles y anclajes externos parecen íntegros',
    'lente aparentemente íntegra; funcionamento não confirmado': 'lente aparentemente íntegra; funcionamiento no confirmado',
    'marcas de uso externas, sem dano estrutural evidente': 'marcas de uso externas, sin daño estructural evidente',
    'lentes aparentemente íntegras; funcionamento não confirmado': 'lentes aparentemente íntegras; funcionamiento no confirmado',
    'km usados desde a última referência': 'km usados desde la última referencia',
    'Histórico desconhecido: faça uma revisão de entrada antes de confiar nos prazos. Priorize óleo, freios, pneus, corrente, filtro de ar, vela e suspensão.': 'Historial desconocido: haz una revisión de entrada antes de fiarte de los plazos. Prioriza aceite, frenos, neumáticos, cadena, filtro de aire, bujía y suspensión.',
    'Cadastre uma manutenção para iniciar a análise preventiva.': 'Añade un mantenimiento para iniciar el análisis preventivo.',
    'km/mês': 'km/mes', 'Prioridade alta: ': 'Prioridad alta: ', ' está vencida. Evite adiar e faça uma inspeção antes de continuar usando a moto.': ' está vencido. No lo dejes y revísalo antes de seguir usando la moto.',
    'Antecipe ': 'Anticípate a ', ': ': ': ', 'Tudo em dia. O próximo item a acompanhar é ': 'Todo al día. El próximo elemento a vigilar es ', ', com ': ', con ',
    'No ritmo atual, o assistente projeta os prazos usando ': 'Al ritmo actual, el asistente proyecta los plazos usando ', ' km por dia.': ' km por día.',
    'Atualize o hodômetro em dias diferentes. Após duas leituras, o app aprende seu ritmo e passa a estimar datas.': 'Actualiza el odómetro en días distintos. Tras dos lecturas, la app aprende tu ritmo y empieza a estimar fechas.',
    'Confirmar na ordem de serviço': 'Confirmar en la orden de trabajo', 'confirmar manutenção': 'confirmar mantenimiento', 'dias restantes': 'días restantes',
    'Total gasto': 'Gasto total', 'Preço médio': 'Precio medio', 'Editar': 'Editar', 'ativa': 'activa',
    'Leitura anterior:': 'Lectura anterior:', 'Próxima leitura:': 'Próxima lectura:', 'Primeira leitura do histórico': 'Primera lectura del historial',
    'Informe um hodômetro entre a leitura anterior e a próxima.': 'Indica un odómetro entre la lectura anterior y la siguiente.',
    'Excluir esta leitura?': '¿Eliminar esta lectura?', 'A quilometragem não pode ser menor que a atual.': 'El kilometraje no puede ser menor que el actual.',
    'Leitura automática indisponível neste navegador. Digite os km manualmente.': 'Lectura automática no disponible en este navegador. Introduce los km manualmente.',
    'Nenhum número legível. Confirme os km manualmente.': 'Ningún número legible. Confirma los km manualmente.',
    'Valor lido da foto. Confira antes de salvar.': 'Valor leído de la foto. Comp ruébalo antes de guardar.',
    'Não foi possível ler a foto. Digite os km manualmente.': 'No se pudo leer la foto. Introduce los km manualmente.',
    'Informe um intervalo em km ou meses.': 'Indica un intervalo en km o meses.',
    'A km da última troca não pode superar a km atual.': 'El km del último cambio no puede superar el kilometraje actual.',
    'Excluir esta manutenção?': '¿Eliminar este mantenimiento?', 'Marque ao menos um item verificado.': 'Marca al menos un elemento verificado.',
    'Informe o nome e uma quilometragem válida.': 'Indica un nombre y un kilometraje válido.',
    'Informe litros, valor e km válidos (até a km atual).': 'Indica litros, importe y km válidos (hasta el km actual).',
    'Escolha um arquivo.': 'Elige un archivo.', 'Arquivo acima de 8 MB.': 'Archivo mayor de 8 MB.',
    'Não foi possível salvar o anexo.': 'No se pudo guardar el adjunto.', 'Excluir anexo': 'Eliminar adjunto', 'Excluir este anexo?': '¿Eliminar este adjunto?',
    'IndexedDB indisponível.': 'IndexedDB no disponible.', 'Nenhum endpoint de push registrado.': 'Ningún endpoint de push registrado.',
    'Endpoint registrado:': 'Endpoint registrado:', 'Arquivo de backup inválido.': 'Archivo de copia no válido.',
    'Não foi possível gerar o link.': 'No se pudo generar el enlace.', 'Link de sincronización inválido.': 'Enlace de sincronización no válido.',
    'Link copiado. Abra-o em outro dispositivo para transferir os dados.': 'Enlace copiado. Ábrelo en otro dispositivo para transferir los datos.',
    'Resumo copiado para a área de transferência.': 'Resumen copiado al portapapeles.'
  }
};
const t = text => I18N[state.ui.lang]?.[text] ?? String(text);
const isI18nKey = value => Object.values(I18N).some(dict => Object.hasOwn(dict, value));
const isTranslationOf = (raw, source) => Object.values(I18N).some(dict => dict[source] === raw);
const resolveI18nSource = (raw, cached) => {
  if (cached !== undefined && cached !== null && isTranslationOf(raw, cached)) return cached;
  return isI18nKey(raw) ? raw : null;
};
const setTextNode = (node, value) => {
  const before = /^\s*/.exec(node.nodeValue)?.[0] ?? '';
  const after = /\s*$/.exec(node.nodeValue)?.[0] ?? '';
  node.nodeValue = `${before}${value}${after}`;
};

function applyLang() {
  document.documentElement.lang = state.ui.lang === 'pt' ? 'pt-BR' : state.ui.lang;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.parentElement?.closest('script, style, svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue.trim();
    if (!raw) continue;
    const source = resolveI18nSource(raw, node.__srcText);
    if (source === null) { node.__srcText = null; continue; }
    node.__srcText = source;
    setTextNode(node, t(source));
  }
  document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(element => {
    ['placeholder', 'aria-label', 'title'].forEach(attr => {
      const raw = element.getAttribute(attr);
      if (!raw) return;
      const cacheKey = `__src_${attr}`;
      const source = resolveI18nSource(raw, element[cacheKey]);
      if (source === null) { element[cacheKey] = null; return; }
      element[cacheKey] = source;
      element.setAttribute(attr, t(source));
    });
  });
}

function normalizeState(saved) {
  if (!isRecord(saved) || !isRecord(saved.bike) || !Array.isArray(saved.maintenance)) return null;
  const data = { ...saved };
  data.bike = {
    ...saved.bike,
    id: saved.bike.id || uid(),
    name: String(saved.bike.name || 'TVS Sport').trim() || 'TVS Sport',
    year: typeof saved.bike.year === 'string' ? saved.bike.year : '',
    currentKm: nonNegative(saved.bike.currentKm),
    historyUnknown: Boolean(saved.bike.historyUnknown),
    deliveryReviewKm: optionalNumber(saved.bike.deliveryReviewKm),
    deliveryReviewDate: validDateKey(saved.bike.deliveryReviewDate) ? saved.bike.deliveryReviewDate : ''
  };
  data.maintenance = normalizeMaintenance(saved.maintenance);
  data.odometerHistory = normalizeHistory(saved.odometerHistory);
  data.serviceLog = cleanList(saved.serviceLog).map(entry => ({
    ...entry, id: entry.id || uid(), name: String(entry.name || ''),
    date: validDateKey(entry.date) ? entry.date : '', km: nonNegative(entry.km),
    cost: nonNegative(entry.cost), note: typeof entry.note === 'string' ? entry.note : ''
  }));
  data.fuelLog = cleanList(saved.fuelLog).map(entry => ({
    ...entry, id: entry.id || uid(), date: validDateKey(entry.date) ? entry.date : '',
    km: nonNegative(entry.km), liters: nonNegative(entry.liters), price: nonNegative(entry.price),
    station: typeof entry.station === 'string' ? entry.station : ''
  }));
  data.roster = cleanList(saved.roster).map(normalizeSnapshot).filter(Boolean);
  data.inspection = isRecord(saved.inspection) && validDateKey(saved.inspection.date) ? {
    date: saved.inspection.date, km: nonNegative(saved.inspection.km),
    checks: isRecord(saved.inspection.checks) ? saved.inspection.checks : {}
  } : null;
  data.notificationsOn = Boolean(saved.notificationsOn);
  data.signature = typeof saved.signature === 'string' && saved.signature.startsWith('data:image/') ? saved.signature : null;
  data.ui = {
    theme: ['dark', 'light'].includes(saved.ui?.theme) ? saved.ui.theme : defaultTheme(),
    lang: ['pt', 'en', 'es'].includes(saved.ui?.lang) ? saved.ui.lang : 'pt'
  };
  data.push = {
    enabled: Boolean(saved.push?.enabled),
    vapid: typeof saved.push?.vapid === 'string' ? saved.push.vapid : '',
    endpoint: typeof saved.push?.endpoint === 'string' ? saved.push.endpoint : ''
  };
  const scheduleVersion = typeof saved.scheduleVersion === 'string' && saved.scheduleVersion ? saved.scheduleVersion : '';
  data.scheduleVersion = scheduleVersion || SCHEDULE_VERSION;
  normalizeTires(data);
  upgradeSchedule(data, scheduleVersion);
  return data;
}
function normalizeSnapshot(saved) {
  const data = normalizeState(saved);
  if (!data) return null;
  return {
    bike: data.bike, odometerHistory: data.odometerHistory, scheduleVersion: data.scheduleVersion,
    serviceLog: data.serviceLog, fuelLog: data.fuelLog, inspection: data.inspection,
    maintenance: data.maintenance, tires: data.tires
  };
}

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))) || defaultState(); }
  catch { return defaultState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }

function showPart(name) {
  if (!name || !partInfo[name]) {
    bikeFocus = null;
    $('#partIcon').textContent = '☝️';
    $('#partTitle').textContent = t('Toque em um ponto');
    $('#partDescription').textContent = t('Veja onde ficam os principais itens de manutenção.');
    $('#partWear').classList.add('hidden');
    $('#partSafety').textContent = t('Representação visual aproximada.');
    return;
  }
  bikeFocus = name;
  const [icon, title, description, safety] = partInfo[name];
  $('#partIcon').textContent = icon; $('#partTitle').textContent = t(title);
  $('#partDescription').textContent = t(description); $('#partSafety').textContent = t(safety);
  const maintenance = state.maintenance.find(item => item.name === partMaintenance[name]);
  const wear = maintenance ? maintenanceStatus(maintenance) : null;
  const usedKm = maintenance ? Math.max(0, Number(state.bike.currentKm) - Number(maintenance.lastKm)) : 0;
  $('#partWear').classList.toggle('hidden', !wear);
  if (wear) {
    const percent = Math.round(wear.progress);
    $('#partWearValue').textContent = `${percent}%`;
    $('#partWearFill').style.width = `${percent}%`;
    const tirePosition = name === 'Pneu dianteiro' ? 'front' : name === 'Pneu traseiro' ? 'rear' : null;
    const tire = tirePosition ? tireForecasts().find(item => item.position === tirePosition) : null;
    $('#partWearMeta').textContent = `${formatNumber(usedKm)} ${t('km usados desde a última referência')} • ${wear.reason}${tire ? ` • ${t('Pneu:')} ${Math.round(tire.wear)}% (${formatNumber(tire.kmLeft)} ${t('km restantes')})` : ''}`;
    const visual = photoAssessment[name];
    $('#partPhotoEstimate').textContent = visual
      ? `${t('Fotos:')} ${t(visual[0])} (${t('confiança')} ${t(visual[1])}).`
      : t('Fotos: esta peça não pode ser avaliada visualmente com segurança.');
  }
}

function initBikeViewer() {
  const views = [['Esquerda', 0], ['Frente', Math.PI / 2], ['Direita', Math.PI], ['Traseira', -Math.PI / 2]];
  bikeModel = window.Moto3D.init($('#bike3dCanvas'), name => {
    if (name && name === bikeFocus) { bikeModel.focusPart(null); showPart(null); return; }
    bikeModel.focusPart(name); showPart(name);
  });
  views.forEach(([label, yaw], index) => {
    const button = document.createElement('button');
    button.className = 'angle-tab'; button.type = 'button'; button.textContent = label;
    button.setAttribute('aria-pressed', String(index === 0));
    button.addEventListener('click', () => {
      bikeModel.setView(yaw); showPart(null);
      document.querySelectorAll('.angle-tab').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    });
    $('#angleTabs').append(button);
  });
}
function addMonths(dateString, months) { const date = readDate(validDateKey(dateString) ? dateString : today()); date.setMonth(date.getMonth() + Number(months)); return date; }
const locale = () => ({ pt: 'pt-BR', en: 'en-US', es: 'es-ES' })[state.ui.lang] || 'pt-BR';
function formatDate(date) { return new Intl.DateTimeFormat(locale()).format(date); }
function formatNumber(number) { return new Intl.NumberFormat(locale()).format(Math.max(0, Math.round(number))); }

function usageForecast() {
  const history = sortedReadings();
  if (history.length < 2) return { daily: 0, monthly: 0 };
  const first = history[0], last = history.at(-1);
  const days = Math.max(1, (readDate(last.date) - readDate(first.date)) / DAY);
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
  const urgent = [...items].sort((a, b) => b.data.progress - a.data.progress)[0];
  $('#healthScore').textContent = health;
  $('#healthScore').parentElement.dataset.level = health < 50 ? 'danger' : health < 75 ? 'warning' : 'ok';
  $('#usageRate').textContent = usage.monthly ? `${formatNumber(usage.monthly)} ${t('km/mês')}` : t('Aprendendo');
  $('#nextMilestone').textContent = `${formatNumber(milestone)} km`;
  $('#confirmDeliveryReviewButton').classList.toggle('hidden', !state.bike.historyUnknown || currentKm <= 0);
  if (state.bike.historyUnknown) $('#smartInsight').textContent = t('Histórico desconhecido: faça uma revisão de entrada antes de confiar nos prazos. Priorize óleo, freios, pneus, corrente, filtro de ar, vela e suspensão.');
  else if (!urgent) $('#smartInsight').textContent = t('Cadastre uma manutenção para iniciar a análise preventiva.');
  else if (urgent.data.status === 'overdue') $('#smartInsight').textContent = `${t('Prioridade alta: ')}${t(urgent.item.name)}${t(' está vencida. Evite adiar e faça uma inspeção antes de continuar usando a moto.')}`;
  else if (urgent.data.status === 'warning') $('#smartInsight').textContent = `${t('Antecipe ')}${t(urgent.item.name)}${t(': ')}${t(urgent.data.reason.toLowerCase())}.`;
  else $('#smartInsight').textContent = `${t('Tudo em dia. O próximo item a acompanhar é ')}${t(urgent.item.name)}${t(', com ')}${t(urgent.data.reason.toLowerCase())}.`;
  $('#learningHint').textContent = usage.daily
    ? `${t('No ritmo atual, o assistente projeta os prazos usando ')}${usage.daily.toFixed(1).replace('.', ',')}${t(' km por dia.')}`
    : t('Atualize o hodômetro em dias diferentes. Após duas leituras, o app aprende seu ritmo e passa a estimar datas.');
}

function maintenanceStatus(item) {
  const lastKm = nonNegative(item.lastKm);
  const currentKm = nonNegative(state.bike.currentKm);
  const intervalKm = nonNegative(item.intervalKm);
  const lastDate = validDateKey(item.lastDate) ? item.lastDate : today();
  const kmLimit = intervalKm > 0 ? (lastKm === 0 && Number(item.firstKm) > 0 ? Number(item.firstKm) : lastKm + intervalKm) : Infinity;
  const kmLeft = kmLimit - currentKm;
  const monthsToUse = lastKm === 0 && Number(item.firstMonths) > 0 ? Number(item.firstMonths) : nonNegative(item.intervalMonths);
  const dateLimit = monthsToUse > 0 ? addMonths(lastDate, monthsToUse) : null;
  const dateStart = readDate(lastDate);
  const daysLeft = dateLimit ? Math.ceil((dateLimit - new Date()) / DAY) : Infinity;
  const kmProgress = Number.isFinite(kmLimit) ? (currentKm - lastKm) / intervalKm : 0;
  const dateProgress = dateLimit && dateLimit > dateStart ? (new Date() - dateStart) / (dateLimit - dateStart) : 0;
  const progress = Math.max(kmProgress, Number.isFinite(dateProgress) ? dateProgress : 0, 0);
  if ((state.bike.historyUnknown || item.historyUnknown) && lastKm === 0) return { status: 'warning', progress: 90, reason: t(item.historyUnknown ? 'Confirmar na ordem de serviço' : 'Histórico desconhecido'), next: t('confirmar manutenção'), forecastDate: null };
  const overdue = kmLeft <= 0 || daysLeft <= 0;
  const warning = !overdue && (kmLeft <= Math.max(300, intervalKm * .1) || daysLeft <= 30 || progress >= .9);
  const reason = kmLeft <= 0 ? `${formatNumber(Math.abs(kmLeft))} ${t('km atrasado')}` : daysLeft <= 0 ? `${Math.abs(daysLeft)} ${t('dias atrasado')}` : warning ? (kmLeft / Math.max(daysLeft, 1) < 15 ? `${t('Faltam')} ${formatNumber(kmLeft)} ${t('km')}` : `${t('Faltam')} ${daysLeft} ${t('dias')}`) : Number.isFinite(kmLeft) ? `${formatNumber(kmLeft)} ${t('km restantes')}` : `${daysLeft} ${t('dias restantes')}`;
  const usage = usageForecast();
  const forecastDate = usage.daily > 0 && Number.isFinite(kmLeft) && kmLeft > 0 ? new Date(Date.now() + (kmLeft / usage.daily) * DAY) : null;
  const effectiveDate = forecastDate && (!dateLimit || forecastDate < dateLimit) ? forecastDate : dateLimit;
  const next = [Number.isFinite(kmLimit) ? `${formatNumber(kmLimit)} km` : '', effectiveDate ? `${t('estimativa')} ${formatDate(effectiveDate)}` : ''].filter(Boolean).join(' · ');
  return { status: overdue ? 'overdue' : warning ? 'warning' : 'ok', progress: Math.min(progress * 100, 100), reason, next, forecastDate: effectiveDate };
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
    card.querySelector('.item-title').textContent = t(item.name);
    card.querySelector('.item-detail').textContent = `${t('Próxima:')} ${data.next}`;
    card.querySelector('.wear-copy').textContent = `${t('Uso do ciclo:')} ${Math.round(data.progress)}% • ${formatNumber(Math.max(0, Number(state.bike.currentKm) - Number(item.lastKm)))} km`;
    card.querySelector('.progress-fill').style.width = `${data.progress}%`;
    card.querySelector('.status-copy').textContent = data.reason;
    card.querySelector('button').addEventListener('click', () => openMaintenance(item));
    list.append(card);
  });
  if (!state.maintenance.length) list.innerHTML = `<div class="empty">${t('Nenhuma manutenção cadastrada.')}</div>`;
  $('#okCount').textContent = counts.ok; $('#warningCount').textContent = counts.warning; $('#overdueCount').textContent = counts.overdue;
  const totalCost = state.serviceLog.reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0);
  const totalFuel = state.fuelLog.reduce((sum, entry) => sum + (Number(entry.price) || 0), 0);
  const references = [state.bike.deliveryReviewKm, state.odometerHistory[0]?.km, ...state.maintenance.map(item => item.lastKm)].map(Number).filter(value => value > 0);
  const startKm = references.length ? Math.min(...references) : 0;
  const driven = Number(state.bike.currentKm) - startKm;
  $('#totalCost').textContent = totalCost > 0 ? formatMoney(totalCost) : '—';
  $('#serviceCount').textContent = state.serviceLog.length;
  $('#costPerKm').textContent = totalCost + totalFuel > 0 && driven > 1 ? formatMoney((totalCost + totalFuel) / driven) : '—';
  const fuelByKm = [...state.fuelLog].sort((a, b) => Number(a.km) - Number(b.km));
  const liters = fuelByKm.reduce((sum, entry) => sum + (Number(entry.liters) || 0), 0);
  const spanKm = fuelByKm.length > 1 ? Number(fuelByKm.at(-1).km) - Number(fuelByKm[0].km) : 0;
  $('#avgConsumption').textContent = spanKm > 0 && liters > 0 ? `${(spanKm / liters).toFixed(1).replace('.', ',')} km/L` : '—';
  renderServiceLog();
  renderFuel();
  renderAttachments();
  renderUsageChart();
  renderCalendar();
  renderTires();
  renderInspection();
  showPart(bikeFocus);
  updateMarkerStatuses(analyzed);
  renderSmartAssistant(analyzed);
  updateAppBadge(counts.overdue + counts.warning);
  applyLang();
}

function updateAppBadge(count) {
  if (!('setAppBadge' in navigator)) return;
  try { count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge(); } catch { /* badge não suportado */ }
}

const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function renderServiceLog() {
  const container = $('#serviceLogList');
  const log = [...state.serviceLog].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || Number(b.km) - Number(a.km));
  $('#serviceLogBadge').textContent = `${log.length} ${t(log.length === 1 ? 'registro' : 'registros')}`;
  if (!log.length) { container.innerHTML = `<div class="empty">${t('Nenhum serviço registrado. Ao editar uma manutenção, o registro entra aqui.')}</div>`; return; }
  container.innerHTML = log.slice(0, 30).map(entry => `
    <article class="log-entry">
      <strong>${escapeHtml(entry.name)}</strong>
      <span class="log-cost">${Number(entry.cost) > 0 ? formatMoney(Number(entry.cost)) : ''}</span>
      <span class="log-date">${entry.date ? formatDate(new Date(`${entry.date}T12:00:00`)) : '—'}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}</span>
      <span class="log-km">${formatNumber(entry.km)} km</span>
    </article>`).join('');
}

function renderFuel() {
  const container = $('#fuelList');
  const entries = [...state.fuelLog].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const spent = entries.reduce((sum, entry) => sum + (Number(entry.price) || 0), 0);
  const liters = entries.reduce((sum, entry) => sum + (Number(entry.liters) || 0), 0);
  $('#fuelStats').innerHTML = `<div><span>${t('Total gasto')}</span><strong>${spent > 0 ? formatMoney(spent) : '—'}</strong></div><div><span>${t('Litros')}</span><strong>${liters > 0 ? liters.toFixed(1).replace('.', ',') : '—'}</strong></div><div><span>${t('Preço médio')}</span><strong>${liters > 0 ? formatMoney(spent / liters) + '/L' : '—'}</strong></div>`;
  if (!entries.length) { container.innerHTML = `<div class="empty">${t('Nenhum abastecimento registrado.')}</div>`; return; }
  const maxLiters = Math.max(...entries.map(entry => Number(entry.liters) || 0), 1);
  container.innerHTML = entries.slice(0, 20).map(entry => `
    <article class="fuel-entry">
      <div><strong>${formatMoney(Number(entry.price) || 0)}</strong><span>${escapeHtml(entry.date || '')} · ${formatNumber(entry.km)} km${entry.station ? ` · ${escapeHtml(entry.station)}` : ''}</span><div class="fuel-bar"><i style="width:${Math.round((Number(entry.liters) || 0) / maxLiters * 100)}%"></i></div></div>
      <div class="fuel-entry-side"><strong>${Number(entry.liters).toFixed(2).replace('.', ',')} L</strong><button type="button" data-fuel-edit="${escapeHtml(entry.id)}" aria-label="${t('Editar')}">✎</button></div>
    </article>`).join('');
  container.querySelectorAll('[data-fuel-edit]').forEach(button => button.addEventListener('click', () => openFuel(state.fuelLog.find(entry => entry.id === button.dataset.fuelEdit))));
}

const DB_NAME = 'onront-files';
let attachmentUrls = [], attachmentRenderId = 0;
function openFilesDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function fileStore(mode, action) {
  const db = await openFilesDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', mode);
    const request = action(transaction.objectStore('files'));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const putFile = record => fileStore('readwrite', store => store.put(record));
const getFiles = () => fileStore('readonly', store => store.getAll());
const deleteFile = id => fileStore('readwrite', store => store.delete(id));

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.72));
}

async function renderAttachments() {
  const renderId = ++attachmentRenderId;
  const urls = [];
  const container = $('#attachmentList');
  const commit = html => {
    if (renderId !== attachmentRenderId) { urls.forEach(url => URL.revokeObjectURL(url)); return false; }
    attachmentUrls.forEach(url => URL.revokeObjectURL(url));
    attachmentUrls = urls;
    container.innerHTML = html;
    return true;
  };
  if (!('indexedDB' in window)) { commit(`<div class="empty">${t('IndexedDB indisponível.')}</div>`); return; }
  let files = [];
  try { files = (await getFiles()).filter(record => record.bikeId === state.bike.id); } catch { /* banco indisponível */ }
  if (!files.length) { commit(`<div class="empty">${t('Nenhum anexo. Use + Anexar para guardar fotos ou notas fiscais.')}</div>`); return; }
  const html = files.map(record => {
    const url = URL.createObjectURL(record.blob); urls.push(url);
    return `<article class="attachment-entry">
      <a href="${url}" target="_blank" rel="noopener">${record.type.startsWith('image/') ? `<img src="${url}" alt="">` : '<span class="file-icon">📄</span>'}<span><strong>${escapeHtml(record.note || record.name)}</strong><small>${escapeHtml(record.name)}</small></span></a>
      <button type="button" data-file-delete="${escapeHtml(record.id)}" aria-label="${t('Excluir anexo')}">✕</button>
    </article>`;
  }).join('');
  if (!commit(html)) return;
  container.querySelectorAll('[data-file-delete]').forEach(button => button.addEventListener('click', async () => { if (confirm(t('Excluir este anexo?'))) { await deleteFile(button.dataset.fileDelete); renderAttachments(); } }));
}

function renderUsageChart() {
  const container = $('#usageChart');
  const history = sortedReadings();
  if (history.length < 2) { container.innerHTML = `<p class="chart-hint">${t('Gráfico de uso disponível após 2 leituras de hodômetro em dias diferentes.')}</p>`; return; }
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
    <div class="chart-caption"><span>${history.length} ${t('leituras')} · ${formatNumber(minKm)}–${formatNumber(maxKm)} km</span><span>${usage.daily > 0 ? `${usage.daily.toFixed(1).replace('.', ',')} ${t('km/dia')}` : t('Ritmo em aprendizado')}</span></div>`;
}

const sortedReadings = () => normalizeHistory(state.odometerHistory);

function estimateKm(key) {
  const history = sortedReadings();
  const exact = history.find(reading => reading.date === key);
  if (exact) return Number(exact.km);
  const before = [...history].reverse().find(reading => reading.date < key);
  const after = history.find(reading => reading.date > key);
  const time = readDate(key);
  if (before && after) {
    const span = (readDate(after.date) - readDate(before.date)) / DAY;
    if (span > 0) return Number(before.km) + (Number(after.km) - Number(before.km)) * ((time - readDate(before.date)) / DAY) / span;
  }
  const anchor = before || after;
  if (!anchor) return null;
  const days = Math.abs((time - readDate(anchor.date)) / DAY);
  return Math.max(0, Number(anchor.km) + (before ? 1 : -1) * days * usageForecast().daily);
}

let calendarMonth = new Date();
calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);

function renderCalendar() {
  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
  $('#calendarMonth').textContent = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(calendarMonth);
  const history = sortedReadings();
  const readings = new Map(history.map(reading => [reading.date, Number(reading.km)]));
  const daily = usageForecast().daily;
  const events = new Map();
  state.maintenance.forEach(item => {
    const data = maintenanceStatus(item);
    if (!data.forecastDate) return;
    const key = dateKey(data.forecastDate);
    events.set(key, [...(events.get(key) || []), data.status]);
  });
  tireForecasts().forEach(tire => {
    if (!tire.date) return;
    const key = dateKey(tire.date);
    events.set(key, [...(events.get(key) || []), tire.status]);
  });
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  let cells = '<div class="cal-cell blank"></div>'.repeat(offset);
  for (let day = 1; day <= days; day++) {
    const key = dateKey(new Date(year, month, day));
    const km = readings.get(key);
    const previous = history.filter(reading => reading.date < key).at(-1);
    const driven = km != null && previous ? Math.max(0, km - Number(previous.km)) : null;
    const statuses = events.get(key) || [];
    const eventClass = statuses.includes('overdue') ? 'overdue' : statuses.includes('warning') ? 'warning' : 'ok';
    const label = `${formatDate(readDate(key))}${km != null ? `, ${formatNumber(km)} km` : daily > 0 ? `, ${t('estimativa')} ${formatNumber(daily)} km` : ''}${statuses.length ? `, ${t('manutenção prevista')}` : ''}`;
    cells += `<button type="button" class="cal-cell${key === today() ? ' today' : ''}${km != null ? ' read' : ' estimate'}${statuses.length ? ` event ${eventClass}` : ''}" data-date="${key}"${key === today() ? ' aria-current="date"' : ''} aria-label="${escapeHtml(label)}">
      <span class="cal-day">${day}</span>
      <span class="cal-value">${km != null ? (previous ? `+${formatNumber(driven)}` : '•') : daily > 0 ? `~${formatNumber(daily)}` : ''}</span>
      ${statuses.length ? '<i class="cal-dot"></i>' : ''}
    </button>`;
  }
  $('#calendarGrid').innerHTML = cells;
  $('#calendarGrid').querySelectorAll('[data-date]').forEach(button => button.addEventListener('click', () => openDay(button.dataset.date)));
  const upcoming = [
    ...state.maintenance.map(item => ({ name: item.name, data: maintenanceStatus(item) })),
    ...tireForecasts().filter(tire => tire.date).map(tire => ({ name: tire.name, data: { forecastDate: tire.date, status: tire.status } }))
  ].filter(entry => entry.data.forecastDate).sort((a, b) => a.data.forecastDate - b.data.forecastDate).slice(0, 3);
  $('#calendarForecast').innerHTML = upcoming.length ? `<strong class="forecast-title">${t('Próximas manutenções')}</strong>${upcoming.map(({ name, data }) => `<div class="forecast-row"><i class="legend-dot ${data.status}"></i><span>${escapeHtml(t(name))}</span><strong>${formatDate(data.forecastDate)}</strong></div>`).join('')}` : '';
}

const tireNames = { front: 'Pneu dianteiro', rear: 'Pneu traseiro' };
function tireForecasts() {
  const daily = usageForecast().daily;
  const currentKm = Number(state.bike.currentKm);
  return ['front', 'rear'].map(position => {
    const tire = state.tires?.[position] || {};
    if (tire.startKm == null || tire.startKm === '') return null;
    const startKm = Number(tire.startKm);
    const lifeKm = Number(tire.lifeKm);
    if (!Number.isFinite(startKm) || !(lifeKm > 0)) return null;
    const usedKm = Math.max(0, currentKm - startKm);
    const wear = Math.min(100, usedKm / lifeKm * 100);
    const kmLeft = Math.max(0, lifeKm - usedKm);
    const date = daily > 0 && kmLeft > 0 ? new Date(Date.now() + kmLeft / daily * DAY) : null;
    const status = wear >= 100 ? 'overdue' : wear >= 80 ? 'warning' : 'ok';
    return { position, name: tireNames[position], startKm, lifeKm, usedKm, kmLeft, wear, date, status };
  }).filter(Boolean);
}

function renderTires() {
  const container = $('#tireGrid');
  const rows = tireForecasts();
  if (!rows.length) { container.innerHTML = `<div class="empty">${t('Informe a km de instalação dos pneus para ver a estimativa.')}</div>`; return; }
  container.innerHTML = rows.map(row => {
    const level = row.wear >= 100 ? t('Substituir agora') : row.wear >= 80 ? t('Planejar troca') : t('Em uso');
    const meta = row.date ? `${t('Previsão:')} ${formatDate(row.date)}` : t('Ritmo de uso ainda em aprendizado');
    return `<article class="tire-row" data-status="${row.status}">
      <div class="tire-head"><div><strong>${t(row.name)}</strong><span>${formatNumber(row.usedKm)} / ${formatNumber(row.lifeKm)} km</span></div><b>${Math.round(row.wear)}%</b></div>
      <div class="tire-track"><i style="width:${row.wear}%"></i></div>
      <div class="tire-meta"><span>${level} · ${formatNumber(row.kmLeft)} ${t('km restantes')}</span><span>${meta}</span></div>
    </article>`;
  }).join('');
}

function openTireDialog() {
  const values = normalizeTires({ tires: state.tires }).tires;
  ['front', 'rear'].forEach(position => {
    const tire = values[position];
    $(`#${position}StartKm`).value = tire.startKm ?? '';
    $(`#${position}StartDate`).value = tire.startDate || '';
    $(`#${position}LifeKm`).value = tire.lifeKm;
  });
  $('#tireError').textContent = '';
  $('#tireDialog').showModal();
}

$('#tireSettingsButton').addEventListener('click', openTireDialog);
document.querySelectorAll('[data-tire-now]').forEach(button => button.addEventListener('click', () => {
  const position = button.dataset.tireNow;
  $(`#${position}StartKm`).value = state.bike.currentKm;
  $(`#${position}StartDate`).value = today();
  $('#tireError').textContent = '';
}));
$('#tireForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const currentKm = Number(state.bike.currentKm);
  const next = defaultTires();
  for (const position of ['front', 'rear']) {
    const rawStart = $(`#${position}StartKm`).value.trim();
    const startKm = rawStart === '' ? null : Number(rawStart);
    const lifeKm = Number($(`#${position}LifeKm`).value);
    if ((startKm != null && (!Number.isFinite(startKm) || startKm < 0 || startKm > currentKm)) || !(lifeKm > 0)) {
      $('#tireError').textContent = t('Informe km de instalação até a km atual e vida útil maior que zero.');
      return;
    }
    next[position] = { startKm, startDate: $(`#${position}StartDate`).value, lifeKm };
  }
  state.tires = next;
  $('#tireDialog').close();
  saveState();
});

function openDay(key) {
  const history = sortedReadings();
  const existing = history.find(reading => reading.date === key);
  const estimate = estimateKm(key);
  $('#dayDate').value = key;
  $('#dayDateLabel').textContent = formatDate(readDate(key));
  $('#dayKm').value = existing ? Number(existing.km) : Math.round(estimate ?? Number(state.bike.currentKm));
  $('#deleteDayButton').classList.toggle('hidden', !existing);
  const previous = history.filter(reading => reading.date < key).at(-1);
  const next = history.find(reading => reading.date > key);
  const reference = previous ? `${t('Leitura anterior:')} ${formatDate(readDate(previous.date))} · ${formatNumber(previous.km)} km` : next ? `${t('Próxima leitura:')} ${formatDate(readDate(next.date))} · ${formatNumber(next.km)} km` : t('Primeira leitura do histórico');
  $('#dayHint').textContent = `${reference}${estimate != null ? ` · ${t('estimativa')}: ${formatNumber(estimate)} km` : ''}.`;
  $('#dayError').textContent = '';
  $('#dayDialog').showModal();
}

$('#calendarTodayButton').addEventListener('click', () => openDay(today()));
$('#calendarPrev').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); renderCalendar(); });
$('#calendarNext').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); renderCalendar(); });
$('#dayForm').addEventListener('submit', event => {
  event.preventDefault();
  const key = $('#dayDate').value;
  const value = Number($('#dayKm').value);
  const history = sortedReadings();
  const previous = history.filter(reading => reading.date < key).at(-1);
  const next = history.find(reading => reading.date > key);
  if (!Number.isFinite(value) || value < 0 || (previous && value < Number(previous.km)) || (next && value > Number(next.km))) {
    $('#dayError').textContent = t('Informe um hodômetro entre a leitura anterior e a próxima.'); return;
  }
  const existing = state.odometerHistory.find(reading => reading.date === key);
  if (existing) existing.km = value;
  else state.odometerHistory.push({ date: key, km: value });
  state.odometerHistory = sortedReadings().slice(-60);
  const last = state.odometerHistory.at(-1);
  if (key === today()) state.bike.currentKm = value;
  else if (last && Number(last.km) > Number(state.bike.currentKm)) state.bike.currentKm = Number(last.km);
  $('#dayDialog').close();
  saveState();
});
$('#deleteDayButton').addEventListener('click', () => {
  const key = $('#dayDate').value;
  if (!confirm(t('Excluir esta leitura?'))) return;
  state.odometerHistory = state.odometerHistory.filter(reading => reading.date !== key);
  const last = sortedReadings().at(-1);
  if (key === today() && last) state.bike.currentKm = Number(last.km);
  $('#dayDialog').close();
  saveState();
});

function renderInspection() {
  const card = $('#inspectionCard');
  const inspection = state.inspection;
  const total = document.querySelectorAll('#inspectionForm [name="chk"]').length || 12;
  if (inspection?.date) {
    const count = Object.keys(inspection.checks || {}).length;
    card.classList.add('done'); card.classList.remove('pending');
    $('#inspectionIcon').textContent = '✅';
    $('#inspectionStatus').textContent = `${t('Última inspeção:')} ${formatDate(readDate(inspection.date))}`;
    $('#inspectionMeta').textContent = `${count}/${total} ${t('itens verificados')} • ${formatNumber(inspection.km)} km`;
  } else {
    card.classList.add('pending'); card.classList.remove('done');
    $('#inspectionIcon').textContent = '📋';
    $('#inspectionStatus').textContent = t('Nenhuma inspeção registrada');
    $('#inspectionMeta').textContent = t('Verifique freios, pneus, corrente e luzes');
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
  $('#maintenanceDialogTitle').textContent = t(item ? 'Editar manutenção' : 'Nova manutenção');
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
  if (!Number.isFinite(value) || value < state.bike.currentKm) { event.preventDefault(); $('#kmError').textContent = t('A quilometragem não pode ser menor que a atual.'); return; }
  state.bike.currentKm = value;
  state.bike.historyUnknown = $('#unknownHistoryInput').checked;
  const existingReading = state.odometerHistory.find(reading => reading.date === today());
  if (existingReading) existingReading.km = value;
  else state.odometerHistory.push({ date: today(), km: value });
  state.odometerHistory = state.odometerHistory.slice(-60);
  saveState();
});
$('#scanOdometerButton').addEventListener('click', () => $('#odometerPhoto').click());
$('#odometerPhoto').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const hint = $('#ocrHint');
  if (!('TextDetector' in window)) { hint.textContent = t('Leitura automática indisponível neste navegador. Digite os km manualmente.'); return; }
  try {
    const bitmap = await createImageBitmap(file);
    const detected = await new TextDetector().detect(bitmap);
    const candidates = detected.flatMap(item => String(item.rawValue || '').replace(/\D/g, '')).filter(value => value.length >= 4);
    bitmap.close?.();
    if (!candidates.length) { hint.textContent = t('Nenhum número legível. Confirme os km manualmente.'); return; }
    $('#kmInput').value = candidates.sort((a, b) => b.length - a.length)[0];
    hint.textContent = t('Valor lido da foto. Confira antes de salvar.');
  } catch { hint.textContent = t('Não foi possível ler a foto. Digite os km manualmente.'); }
  event.target.value = '';
});

$('#addMaintenanceButton').addEventListener('click', () => openMaintenance());
$('#maintenanceForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  const intervalKm = Number($('#intervalKm').value || 0), intervalMonths = Number($('#intervalMonths').value || 0), lastKm = Number($('#lastKm').value);
  if ((!intervalKm && !intervalMonths) || lastKm > state.bike.currentKm) { event.preventDefault(); $('#maintenanceError').textContent = t(!intervalKm && !intervalMonths ? 'Informe um intervalo em km ou meses.' : 'A km da última troca não pode superar a km atual.'); return; }
  const cost = Math.max(0, Number($('#itemCost').value || 0));
  const previous = state.maintenance.find(x => x.id === $('#maintenanceId').value);
  const lastDate = validDateKey($('#lastDate').value) ? $('#lastDate').value : today();
  const value = { id: $('#maintenanceId').value || uid(), name: $('#itemName').value.trim(), lastKm, intervalKm, lastDate, intervalMonths, icon: previous?.icon || '🔧', firstKm: previous?.firstKm, firstMonths: previous?.firstMonths, historyUnknown: false, cost };
  const changed = !previous || previous.lastKm !== lastKm || previous.lastDate !== value.lastDate || Number(previous.cost || 0) !== cost;
  if (changed) state.serviceLog.push({ id: uid(), name: value.name, date: value.lastDate, km: lastKm, cost });
  const index = state.maintenance.findIndex(item => item.id === value.id); index >= 0 ? state.maintenance[index] = value : state.maintenance.push(value); saveState();
});
$('#deleteMaintenanceButton').addEventListener('click', () => { if (confirm(t('Excluir esta manutenção?'))) { state.maintenance = state.maintenance.filter(item => item.id !== $('#maintenanceId').value); $('#maintenanceDialog').close(); saveState(); } });
$('#settingsButton').addEventListener('click', () => {
  $('#bikeNameInput').value = state.bike.name; $('#bikeYearInput').value = state.bike.year;
  $('#unknownHistorySettings').checked = Boolean(state.bike.historyUnknown);
  $('#notificationsInput').checked = Boolean(state.notificationsOn);
  $('#pushInput').checked = Boolean(state.push.enabled);
  $('#vapidInput').value = state.push.vapid || '';
  $('#themeSelect').value = state.ui.theme; $('#langSelect').value = state.ui.lang;
  $('#pushStatus').textContent = state.push.endpoint ? `${t('Endpoint registrado:')} ${state.push.endpoint.slice(0, 60)}…` : t('Nenhum endpoint de push registrado.');
  $('#settingsDialog').showModal();
});
$('#settingsForm').addEventListener('submit', async event => {
  if (event.submitter?.value === 'cancel') return;
  state.bike.name = $('#bikeNameInput').value.trim(); state.bike.year = $('#bikeYearInput').value;
  state.bike.historyUnknown = $('#unknownHistorySettings').checked;
  state.notificationsOn = $('#notificationsInput').checked;
  state.ui.theme = $('#themeSelect').value; state.ui.lang = $('#langSelect').value;
  state.push.vapid = $('#vapidInput').value.trim();
  await setupPush($('#pushInput').checked);
  applyTheme(); saveState();
});

function applyTheme() { document.documentElement.dataset.theme = state.ui.theme; }
function urlBase64ToUint8Array(base64) {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64.length + 3) % 4);
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}
async function setupPush(enabled) {
  state.push.enabled = Boolean(enabled);
  if (!enabled) { state.push.endpoint = ''; return; }
  if (!state.push.vapid || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('push timeout')), ms))]);
  try {
    const registration = await withTimeout(navigator.serviceWorker.ready, 3000);
    const subscription = await withTimeout(registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(state.push.vapid) }), 5000);
    state.push.endpoint = subscription.endpoint;
  } catch { state.push.endpoint = ''; }
}
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
$('#importInput').addEventListener('change', async event => { try { const data = normalizeState(JSON.parse(await event.target.files[0].text())); if (!data) throw new Error(); state = data; applyTheme(); saveState(); $('#settingsDialog').close(); } catch { alert(t('Arquivo de backup inválido.')); } event.target.value = ''; });
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
  if (!Object.keys(checks).length) { event.preventDefault(); $('#inspectionError').textContent = t('Marque ao menos um item verificado.'); return; }
  state.inspection = { date: today(), km: state.bike.currentKm, checks };
  saveState();
});
$('#clearInspectionButton').addEventListener('click', () => { state.inspection = null; saveState(); $('#inspectionDialog').close(); });

// --- Garagem (multi-moto por troca de snapshot) ---
const bikeSnapshot = () => normalizeSnapshot({
  bike: state.bike, odometerHistory: state.odometerHistory, scheduleVersion: state.scheduleVersion,
  serviceLog: state.serviceLog, fuelLog: state.fuelLog, inspection: state.inspection,
  maintenance: state.maintenance, tires: state.tires
}) || normalizeSnapshot(defaultState());
const applyBikeSnapshot = raw => {
  const snap = normalizeSnapshot(raw) || normalizeSnapshot(defaultState());
  state.bike = snap.bike; state.odometerHistory = snap.odometerHistory; state.scheduleVersion = snap.scheduleVersion;
  state.serviceLog = snap.serviceLog; state.fuelLog = snap.fuelLog; state.inspection = snap.inspection;
  state.maintenance = snap.maintenance; state.tires = snap.tires;
};

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

// --- Abastecimentos ---
function openFuel(entry) {
  $('#fuelForm').reset(); $('#fuelError').textContent = '';
  $('#fuelId').value = entry?.id || '';
  $('#fuelDate').value = entry?.date || today();
  $('#fuelKm').value = entry?.km ?? state.bike.currentKm;
  $('#fuelLiters').value = entry?.liters || '';
  $('#fuelPrice').value = entry?.price || '';
  $('#fuelStation').value = entry?.station || '';
  $('#deleteFuelButton').classList.toggle('hidden', !entry);
  $('#fuelDialog').showModal();
}
$('#addFuelButton').addEventListener('click', () => openFuel());
$('#fuelForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  const liters = Number($('#fuelLiters').value), price = Number($('#fuelPrice').value), km = Number($('#fuelKm').value);
  if (!(liters > 0) || !(price >= 0) || !Number.isFinite(km) || km > state.bike.currentKm) { event.preventDefault(); $('#fuelError').textContent = 'Informe litros, valor e km válidos (até a km atual).'; return; }
  const entry = { id: $('#fuelId').value || uid(), date: $('#fuelDate').value, km, liters, price, station: $('#fuelStation').value.trim() };
  const index = state.fuelLog.findIndex(item => item.id === entry.id);
  index >= 0 ? state.fuelLog[index] = entry : state.fuelLog.push(entry);
  saveState();
});
$('#deleteFuelButton').addEventListener('click', () => { if (confirm('Excluir este abastecimento?')) { state.fuelLog = state.fuelLog.filter(item => item.id !== $('#fuelId').value); $('#fuelDialog').close(); saveState(); } });

// --- Anexos (IndexedDB) ---
$('#addAttachmentButton').addEventListener('click', () => {
  $('#attachmentForm').reset(); $('#attachmentError').textContent = '';
  $('#attachmentService').innerHTML = '<option value="">—</option>' + [...state.serviceLog].reverse().map(entry => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)} · ${escapeHtml(entry.date || '')}</option>`).join('');
  $('#attachmentDialog').showModal();
});
$('#attachmentForm').addEventListener('submit', async event => {
  event.preventDefault();
  const file = $('#attachmentFile').files[0];
  if (!file) { $('#attachmentError').textContent = 'Escolha um arquivo.'; return; }
  if (file.size > 8 * 1024 * 1024) { $('#attachmentError').textContent = 'Arquivo acima de 8 MB.'; return; }
  try {
    const blob = file.type.startsWith('image/') ? await compressImage(file) : file;
    await putFile({ id: uid(), bikeId: state.bike.id, name: file.name, type: blob.type || file.type, note: $('#attachmentNote').value.trim(), serviceId: $('#attachmentService').value, createdAt: today(), blob });
    $('#attachmentDialog').close(); renderAttachments();
  } catch { $('#attachmentError').textContent = 'Não foi possível salvar o anexo.'; }
});

// --- Calendário .ics ---
const icsDate = date => dateKey(date).replace(/-/g, '');
const icsText = text => String(text).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
$('#calendarButton').addEventListener('click', () => {
  const events = state.maintenance.map(item => {
    const data = maintenanceStatus(item);
    if (data.status === 'ok') return null;
    const date = data.forecastDate && !Number.isNaN(data.forecastDate.getTime())
      ? data.forecastDate
      : readDate(dateKey(new Date(Date.now() + 7 * DAY)));
    return ['BEGIN:VEVENT', `UID:${item.id}@onront`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART;VALUE=DATE:${icsDate(date)}`, `SUMMARY:${icsText(t(item.name))} (${data.status === 'overdue' ? t('VENCIDO') : t('ATENÇÃO')})`, `DESCRIPTION:${icsText(data.reason)}`, 'END:VEVENT'].join('\r\n');
  }).filter(Boolean);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ONRONT//Manutencoes//PT', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  link.download = `onront-manutencao-${today()}.ics`;
  link.click(); URL.revokeObjectURL(link.href);
});

// --- Sincronização por link (gzip + base64url) ---
const base64urlEncode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const base64urlDecode = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4)), char => char.charCodeAt(0));
async function encodeSyncLink() {
  const json = JSON.stringify(state);
  let encoded, prefix;
  if ('CompressionStream' in window) {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    encoded = base64urlEncode(new Uint8Array(await new Response(stream).arrayBuffer())); prefix = 's';
  } else { encoded = base64urlEncode(new TextEncoder().encode(json)); prefix = 'p'; }
  return `${location.href.split('#')[0]}#sync=${prefix}.${encoded}`;
}
async function applySyncLink(hash) {
  const match = hash.match(/#sync=([sp])\.([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('Link inválido');
  let text;
  if (match[1] === 's') {
    const stream = new Blob([base64urlDecode(match[2])]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else text = new TextDecoder().decode(base64urlDecode(match[2]));
  const data = normalizeState(JSON.parse(text));
  if (!data) throw new Error('Dados inválidos');
  state = data; saveState();
  history.replaceState(null, '', location.pathname + location.search);
}
function renderSyncQr(link) {
  const container = $('#syncQr');
  container.innerHTML = '';
  if (typeof qrcode !== 'function') return;
  try {
    const qr = qrcode(0, 'L');
    qr.addData(link);
    qr.make();
    const count = qr.getModuleCount();
    const size = 232, cell = size / count;
    let rects = '';
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) rects += `<rect x="${(col * cell).toFixed(2)}" y="${(row * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
    }
    container.innerHTML = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-label="QR de sincronização"><rect width="${size}" height="${size}" fill="#fff"/>${rects}</svg>`;
  } catch { /* link muito longo para QR: o texto continua disponível */ }
}
let syncLink = '';
$('#syncExportButton').addEventListener('click', async () => {
  try { syncLink = await encodeSyncLink(); $('#syncText').value = syncLink; renderSyncQr(syncLink); $('#syncDialog').showModal(); }
  catch { alert('Não foi possível gerar o link.'); }
});
$('#syncImportButton').addEventListener('click', () => { $('#syncText').value = ''; $('#syncDialog').showModal(); });
$('#syncApplyButton').addEventListener('click', async () => {
  try { await applySyncLink($('#syncText').value.trim()); $('#syncDialog').close(); location.reload(); }
  catch { alert('Link de sincronização inválido.'); }
});
$('#syncCopyButton').addEventListener('click', async () => {
  const text = syncLink || $('#syncText').value;
  try { await navigator.clipboard.writeText(text); alert('Link copiado. Abra-o em outro dispositivo para transferir os dados.'); }
  catch { alert(text); }
});

// --- Assinatura digital ---
const signatureCanvas = $('#signatureCanvas');
const signatureCtx = signatureCanvas.getContext('2d');
signatureCtx.strokeStyle = '#f5f7f8'; signatureCtx.lineWidth = 3; signatureCtx.lineCap = 'round';
let signing = false;
const signaturePoint = event => { const rect = signatureCanvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * signatureCanvas.width / rect.width, y: (event.clientY - rect.top) * signatureCanvas.height / rect.height }; };
signatureCanvas.addEventListener('pointerdown', event => { signing = true; signatureCanvas.setPointerCapture(event.pointerId); const point = signaturePoint(event); signatureCtx.beginPath(); signatureCtx.moveTo(point.x, point.y); });
signatureCanvas.addEventListener('pointermove', event => { if (!signing) return; const point = signaturePoint(event); signatureCtx.lineTo(point.x, point.y); signatureCtx.stroke(); });
signatureCanvas.addEventListener('pointerup', () => { signing = false; });
$('#clearSignatureButton').addEventListener('click', () => signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height));
$('#saveSignatureButton').addEventListener('click', () => { state.signature = signatureCanvas.toDataURL('image/png'); saveState(); $('#signatureDialog').close(); });
$('#signatureButton').addEventListener('click', () => {
  if (state.signature) { const image = new Image(); image.onload = () => signatureCtx.drawImage(image, 0, 0, signatureCanvas.width, signatureCanvas.height); image.src = state.signature; }
  $('#signatureDialog').showModal();
});
async function orderCode() {
  const text = JSON.stringify({ bike: state.bike, km: state.bike.currentKm, log: state.serviceLog.length, date: today() });
  let code;
  if (crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    code = [...digest].slice(0, 3).map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  } else {
    let hash = 0;
    for (let index = 0; index < text.length; index++) hash = (hash * 31 + text.charCodeAt(index)) | 0;
    code = Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  }
  return `OS-${today().replace(/-/g, '')}-${code}`;
}

// --- Exportar CSV ---
$('#csvButton').addEventListener('click', () => {
  const rows = [['Tipo', 'Data', 'Km', 'Item', 'IntervaloKm', 'Status', 'Custo']];
  state.maintenance.forEach(item => { const status = maintenanceStatus(item); rows.push(['plano', '', String(item.lastKm), item.name, String(item.intervalKm), status.status, Number(item.cost) > 0 ? String(item.cost) : '']); });
  state.serviceLog.forEach(entry => rows.push(['serviço', String(entry.date || ''), String(entry.km), entry.name, '', '', Number(entry.cost) > 0 ? String(entry.cost) : '']));
  state.fuelLog.forEach(entry => rows.push(['abastecimento', String(entry.date || ''), String(entry.km), entry.station || 'Combustível', String(entry.liters), '', String(entry.price)]));
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
$('#printOrderButton').addEventListener('click', async () => {
  const code = await orderCode();
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
      <div><strong>Código de validação:</strong> ${code}</div>
    </div>
    <h2>Itens de manutenção</h2>
    <table><thead><tr><th>Item</th><th>Status</th><th>Uso do ciclo</th><th>Próxima referência</th></tr></thead><tbody>
      ${sorted.map(({ item, data }) => `<tr><td>${escapeHtml(t(item.name))}</td><td>${escapeHtml(t(data.status === 'overdue' ? 'VENCIDO' : data.status === 'warning' ? 'ATENÇÃO' : 'Em dia'))}</td><td>${Math.round(data.progress)}%</td><td>${escapeHtml(data.next)}</td></tr>`).join('')}
    </tbody></table>
    <h2>Serviços recentes</h2>
    ${recent.length ? `<table><thead><tr><th>Data</th><th>Item</th><th>Km</th><th>Custo</th></tr></thead><tbody>
      ${recent.map(entry => `<tr><td>${entry.date ? escapeHtml(formatDate(new Date(`${entry.date}T12:00:00`))) : '—'}</td><td>${escapeHtml(entry.name)}</td><td>${formatNumber(entry.km)}</td><td>${Number(entry.cost) > 0 ? formatMoney(Number(entry.cost)) : '—'}</td></tr>`).join('')}
    </tbody></table>` : '<p>Nenhum serviço registrado.</p>'}
    <div class="so-sign"><div>${state.signature ? `<img src="${state.signature}" alt="Assinatura" class="so-signature">` : ''}Assinatura do responsável</div><div>Carimbo da oficina</div></div>
    <p class="so-foot">Documento gerado pelo ONRONT Manutenções · código ${code}. Desgaste, uso severo e poeira podem exigir antecipação dos intervalos.</p>`;
  $('#settingsDialog').close();
  window.print();
});

initBikeViewer();
applyTheme();
render();
if (location.hash.startsWith('#sync=')) applySyncLink(location.hash).then(() => location.reload()).catch(() => alert('Link de sincronização inválido.'));
else if (location.search.includes('action=km')) $('#kmDialog').showModal();
else if (location.search.includes('action=checklist')) $('#openInspectionButton').click();
else if (location.search.includes('action=calendar')) { $('#calendarTitle').scrollIntoView({ block: 'start' }); openDay(today()); }
if (state.notificationsOn) checkNotifications();
setInterval(checkNotifications, 5 * 60 * 1000);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));

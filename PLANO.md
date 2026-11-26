# Plano de Melhorias — ONRONT Manutenções

Roadmap das 10 melhorias aprovadas para o painel de manutenção.
Estado: **planejamento → implementação concluída** (atualizado em 26/11/2026).

## Visão geral

| # | Melhoria | Prioridade | Status |
|---|----------|-----------|--------|
| 1 | Histórico de manutenções executadas | 🔴 Alta | ✅ Implementado |
| 2 | Custo por manutenção | 🔴 Alta | ✅ Implementado |
| 3 | Lembretes (notificações do navegador) | 🔴 Alta | ✅ Implementado |
| 4 | Gráfico de uso do hodômetro | 🟡 Média | ✅ Implementado |
| 5 | Checklist de inspeção condicional | 🟡 Média | ✅ Implementado |
| 6 | Cores no modelo 3D por status | 🟡 Média | ✅ Implementado |
| 7 | Multi-moto | 🟢 Extra | ✅ Implementado |
| 8 | Resumo compartilhável | 🟢 Extra | ✅ Implementado |
| 9 | Export de CSV | 🟢 Extra | ✅ Implementado |
| 10 | Ordem de serviço (impressão/PDF) | 🟢 Extra | ✅ Implementado |

### Testes executados (26/11/2026)

- ✅ Migração: dados existentes (195.598 km, 9 itens) preservados, zero erros de console
- ✅ Checklist de inspeção: salvar 12/12 itens, exibição no card
- ✅ Livro de serviço: registro com custo (R$ 95,00) e contagem no painel
- ✅ Garagem: criar moto nova, trocar de volta, estado isolado por moto, excluir com confirmação
- ✅ CSV: download `onront-manutencao-2026-11-26.csv`
- ✅ Compartilhar: resumo copiado para a área de transferência
- ✅ Ordem de serviço: HTML gerado com tabela de itens e serviços recentes
- ✅ Dados de teste removidos após a bateria de testes
- ⚠️ Lembretes: testados apenas em código (Notification API requer permissão explícita do usuário)

### Limitação conhecida

- Lembretes notificam apenas com o app aberto (sem servidor push, o PWA não acorda em segundo plano)
- `window.print()` é recusado pela automação do Orca (`blockedPrint`), mas funciona normalmente no navegador do usuário

---

## 1. Histórico de manutenções executadas

**Problema:** editar um item sobrescreve `lastKm`/`lastDate`; o passado se perde.

- Novo array `state.serviceLog[]`: `{id, name, date, km, cost, notes}`
- Ao salvar edição de manutenção com km/data alterados → registrar entrada no log
- Nova seção "Histórico de serviço" abaixo da lista de manutenções
- Migração em `loadState()`: `serviceLog` default `[]`

**Arquivos:** `app.js`, `index.html`, `styles.css`

## 2. Custo por manutenção

**Problema:** não há como saber quanto a moto custa para manter.

- Campo opcional "Custo (R$)" no diálogo de manutenção
- Custo gravado no `serviceLog`
- Célula "Custo acumulado" no `smart-grid`
- Custo por item visível no histórico

**Arquivos:** `app.js`, `index.html`, `styles.css`

## 3. Lembretes (notificações)

**Problema:** só há aviso se o usuário abrir o app.

- Checkbox "Ativar lembretes" nas configurações → `Notification.requestPermission()`
- `state.notificationsOn`
- Verificação periódica (`setInterval`): notifica itens `warning`/`overdue` (1× por sessão por item)
- Limite: sem servidor push, notifica apenas com o app aberto (PWA em segundo plano pode não acionar)

**Arquivos:** `app.js`, `index.html`

## 4. Gráfico de uso do hodômetro

**Problema:** `odometerHistory` (até 60 leituras) é coletado mas nunca exibido.

- SVG nativo (sem lib): polyline das leituras km × data
- Exibido no `smart-card` sob "Ritmo de uso"
- Mostra também km/dia calculados

**Arquivos:** `app.js`, `index.html`, `styles.css`

## 5. Checklist de inspeção condicional

**Problema:** freios/pneus/corrente são "condicionais" no README, sem como registrar a verificação.

- `state.inspection = {date, km, checks:{}}`
- Itens baseados no manual Mottu: corrente (folga 20–30 mm, lubrificação), pneus (TWI, pressão, cortes), freios (pastilhas, disco, manete), luzes
- Botão "Inspeção geral" abre diálogo com checkboxes
- Card no topo da lista mostra última inspeção

**Arquivos:** `app.js`, `index.html`, `styles.css`

## 6. Cores no modelo 3D por status

**Problema:** todos os pontos do modelo são verdes, sem relação com o status real.

- `bike3d.js`: `setMarkerStatus(name, color)` + mapa de cores
- `app.js`: a cada `render()`, mapear `partMaintenance` → `maintenanceStatus()` → cor
- Verde = em dia, âmbar = atenção, vermelho = vencido

**Arquivos:** `bike3d.js`, `app.js`

## 7. Multi-moto

**Problema:** o app só rastreia uma moto.

- Estratégia de "troca por snapshot": `state.roster[]` guarda o estado completo das outras motos
- A moto ativa permanece em `state.bike`/`state.maintenance` (código intacto)
- Diálogo "Trocar moto": lista, adicionar nova, remover (não a ativa)
- `bike.id` (uid) para referência estável

**Arquivos:** `app.js`, `index.html`, `styles.css`

## 8. Resumo compartilhável

- Botão gera texto formatado (moto, km, saúde, contagens, próximos itens)
- `navigator.share()` quando disponível, senão copiar para área de transferência

**Arquivos:** `app.js`, `index.html`

## 9. Export de CSV

- "Exportar CSV" ao lado do backup JSON
- Colunas: `Tipo;Data;Km;Item;IntervaloKm;Status;Custo`
- `Tipo=plano` (itens atuais) e `Tipo=serviço` (histórico)

**Arquivos:** `app.js`, `index.html`

## 10. Ordem de serviço (impressão/PDF)

- Botão "Ordem de serviço" gera visão imprimível: cabeçalho, dados da moto, tabela de itens por status, histórico recente, espaço para assinatura
- Div oculta `.service-order` + `@media print` esconde o app
- Salvar como PDF pelo diálogo do navegador

**Arquivos:** `app.js`, `index.html`, `styles.css`

---

## Ordem de implementação

1. Migração de dados (`loadState` v2: `serviceLog`, `inspection`, `notificationsOn`, `roster`, `bike.id`)
2. #1 + #2 (histórico e custos — mesma UI)
3. #5 (checklist de inspeção)
4. #4 (gráfico SVG)
5. #3 (lembretes)
6. #6 (cores no 3D)
7. #8 + #9 + #10 (ações: share, CSV, impressão)
8. #7 (multi-moto — por último, maior refactor)
9. Teste de regressão no navegador (dados existentes de 195.598 km preservados)

## Regras

- Dados atuais do `localStorage` (`moto-em-dia-v1`) devem ser migrados sem perda
- Sem dependências externas (PWA offline, tudo vanilla JS)
- Estética atual mantida (dark, `--brand`, cantos 14–22px)

---

# Fase 2 — roadmap estendido

Estado: **modo meta/planejamento → implementação** (26/11/2026).

| # | Melhoria | Esforço | Status |
|---|----------|---------|--------|
| 11 | Exportar vencimentos para calendário `.ics` | Rápido | ⬜ Planejado |
| 12 | Badge no ícone + atalhos na PWA | Rápido | ⬜ Planejado |
| 13 | Custo por km rodado | Rápido | ⬜ Planejado |
| 14 | Tema claro/escuro | Rápido | ⬜ Planejado |
| 15 | Testes automatizados (smoke) | Rápido | ⬜ Planejado |
| 16 | Abastecimentos (km/L, custo por km, autonomia) | Médio | ⬜ Planejado |
| 17 | Fotos e notas fiscais (IndexedDB + compressão) | Médio | ⬜ Planejado |
| 18 | Sincronização entre dispositivos (link/QR, sem servidor) | Médio | ⬜ Planejado |
| 19 | Push real (Web Push + VAPID) | Médio | ⬜ Planejado |
| 20 | OCR do hodômetro (Shape Detection API) | Grande | ⬜ Planejado |
| 21 | Modo oficina (assinatura + código de validação) | Grande | ⬜ Planejado |
| 22 | Internacionalização (pt-BR / en / es) | Grande | ⬜ Planejado |

## Decisões técnicas

- **11** — gerar `BEGIN:VCALENDAR` com `VEVENT` por item vencido/em atenção; `DTSTART;VALUE=DATE`, sem lib.
- **12** — `manifest.shortcuts` (Atualizar km, Checklist) + `navigator.setAppBadge(count)` quando suportado.
- **13** — `(total gasto em serviços + combustível) / km rodados desde a entrega`; exibido no `smart-grid`.
- **14** — `data-theme` no `<html>`, variáveis CSS já centralizadas; persistir em `state.ui.theme` e respeitar `prefers-color-scheme`.
- **15** — `node --test` com asserts estáticos sobre os contratos (IDs, chaves de estado, versão do cache); sem dependências.
- **16** — `state.fuelLog[]` com `{id,date,km,liters,price,station}`; seção "Abastecimentos" com média e gráfico de barras.
- **17** — IndexedDB `onront-files`; redimensionar para 1280 px e JPEG 0.72 antes de gravar; vincular por `serviceLog.id`.
- **18** — `CompressionStream('gzip')` + base64url no `#hash` da URL; gerar QR com SVG próprio. Sem nuvem: o link contém os dados.
- **19** — `PushManager.subscribe()` com chave VAPID configurável; **sem servidor não há disparo remoto** — o app registra o endpoint e mostra onde configurá-lo.
- **20** — `TextDetector` nativo (Chrome/Android) lendo a foto do painel; fallback manual. Sem modelo pesado, mantém PWA offline.
- **21** — assinatura em `<canvas>` embutida na ordem de serviço + código curto SHA-256 dos dados impressos. Validação pública exige backend (fora do escopo estático).
- **22** — dicionário `I18N` com 3 idiomas + `applyLang()` varrendo `[data-i18n]`; `state.ui.lang`.

## Ordem de implementação

1. 13 + 14 + 12 + 11 (rápidos, tocam o mesmo CSS/HTML)
2. 16 (abastecimentos) e 17 (anexos)
3. 18 (sync por link) e 19 (push VAPID)
4. 20 (OCR), 21 (oficina), 22 (i18n)
5. 15 (testes) + bump do service worker + deploy

## Regras adicionais

- Nenhuma dependência externa em runtime (OCR e push usam APIs nativas com fallback).
- Migração `loadState()` deve aceitar backups antigos sem perda.
- Dados de teste criados durante a validação devem ser removidos ao final.

# ONRONT Manutenções

PWA da ONRONT para acompanhar e antecipar a manutenção de motos por quilometragem, tempo e sinais de desgaste.

## Acesso público

**[abrir o app](https://gabrielnt0.github.io/onront-manutencoes/)**

Publicado no GitHub Pages (HTTPS, instalável como PWA). Os dados ficam no `localStorage` de cada origem: para levar os dados do arquivo local para o endereço público, use **Exportar backup (JSON)** na versão local e **Importar backup** na versão publicada.

Inclui um modelo 3D geométrico e interativo da moto: arraste para girar, use pinça ou roda para zoom e toque nos pontos numerados para consultar os principais componentes. O modelo é educativo e aproximado, não uma reprodução técnica para medições ou desmontagem.

## Recursos

- Histórico de manutenção, custo acumulado, custo por km e consumo médio.
- Previsão por quilometragem e tempo, gráfico de uso e lembretes no app (push remoto requer VAPID + servidor).
- Calendário mensal de km: leitura diária do hodômetro, estimativa dos dias sem leitura e marcadores das próximas manutenções previstas.
- Checklist de inspeção, garagem para várias motos e ordem de serviço com assinatura e código de validação.
- Abastecimentos e anexos (imagens comprimidas e PDFs no IndexedDB do navegador).
- Exportação JSON, CSV e calendário `.ics`, compartilhamento de resumo e sincronização por link/QR comprimido (gerado localmente, sem rede).
- Tema claro/escuro, idiomas pt/en/es, atalhos no manifesto e badge de pendências.
- Leitura do hodômetro por foto quando o navegador oferece `TextDetector` (sempre revisar o valor antes de salvar).

## Rodar localmente

Use qualquer servidor HTTP estático. Com Node.js:

```powershell
npx serve .
```

Abra o endereço mostrado no celular ou computador. Os dados ficam salvos no navegador (`localStorage`). Para instalar, use **Adicionar à tela inicial** no menu do navegador.

## Plano oficial da Mottu Sport

Os itens iniciais seguem o [Manual do Proprietário Mottu Sport ESD (revisão 2026)](https://mottu.com.br/documents/manual-mottu-sport-esd.pdf): primeira revisão em 1.000 km/1 mês, revisões posteriores a cada 5.000 km/3 meses, vela e filtro de ar a cada 12.000 km, óleo da bengala a cada 18.000 km e filtro de combustível a cada 24.000 km.

Freios, pneus e corrente são acompanhados como inspeções condicionais. Poeira, uso intenso ou sinais de desgaste podem exigir manutenção antecipada.

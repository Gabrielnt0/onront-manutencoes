# ONRONT Manutenções

PWA da ONRONT para acompanhar e antecipar a manutenção de motos por quilometragem, tempo e sinais de desgaste.

## Acesso público

**[abrir o app](https://gabrielnt0.github.io/onront-manutencoes/)**

Publicado no GitHub Pages (HTTPS, instalável como PWA). Os dados ficam no `localStorage` de cada origem: para levar os dados do arquivo local para o endereço público, use **Exportar backup (JSON)** na versão local e **Importar backup** na versão publicada.

Inclui um modelo 3D geométrico e interativo da moto: arraste para girar, use pinça ou roda para zoom e toque nos pontos numerados para consultar os principais componentes. O modelo é educativo e aproximado, não uma reprodução técnica para medições ou desmontagem.

## Rodar localmente

Use qualquer servidor HTTP estático. Com Node.js:

```powershell
npx serve .
```

Abra o endereço mostrado no celular ou computador. Os dados ficam salvos no navegador (`localStorage`). Para instalar, use **Adicionar à tela inicial** no menu do navegador.

## Plano oficial da Mottu Sport

Os itens iniciais seguem o [Manual do Proprietário Mottu Sport ESD (revisão 2026)](https://mottu.com.br/documents/manual-mottu-sport-esd.pdf): primeira revisão em 1.000 km/1 mês, revisões posteriores a cada 5.000 km/3 meses, vela e filtro de ar a cada 12.000 km, óleo da bengala a cada 18.000 km e filtro de combustível a cada 24.000 km.

Freios, pneus e corrente são acompanhados como inspeções condicionais. Poeira, uso intenso ou sinais de desgaste podem exigir manutenção antecipada.

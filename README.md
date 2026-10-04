# bosnia01 — Apuração 2026

Painel web estático para acompanhar a apuração presidencial de 2026 usando os arquivos JSON oficiais do Tribunal Superior Eleitoral (TSE).

## Objetivo

Apresentar uma leitura estritamente matemática da condição de maioria absoluta no primeiro turno. O portal não produz previsão eleitoral, probabilidade de vitória, tendência ou recomendação política.

## Fonte oficial

- Pleito: 3220 — 1º turno, 04/10/2026
- Eleição federal: 6257
- Cargo: Presidente (0001)
- EA20 nacional: `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json`
- Documentação técnica: `https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados`

## O que o painel mostra

- atualização automática dos resultados oficiais;
- seletor de candidatura com o mesmo critério matemático para todas;
- percentual sobre votos válidos já apurados;
- seções totalizadas, votos válidos e votos da candidatura selecionada;
- distância para a maioria dos votos válidos já apurados;
- envelope matemático usando o eleitorado de seções ainda não totalizadas como teto absoluto de novos votos;
- simulador de cenários hipotéticos sem extrapolação estatística;
- leitura por UF em ordem alfabética;
- cache local da última leitura para falhas temporárias.

## GitHub Pages

O repositório inclui `.github/workflows/pages.yml`.

Se a primeira execução do workflow informar que o Pages ainda não está configurado, abra:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

Depois disso, cada push em `main` publica automaticamente o portal.

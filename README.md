# bosnia01 — Apuração 2026

Portal web para acompanhar a apuração das Eleições Gerais de 2026 com dados oficiais do Tribunal Superior Eleitoral (TSE).

## Experiência

A navegação foi desenhada com uma hierarquia editorial de apuração:

- abas fixas para Presidente, Governador, Senado, Câmara e Assembleia/Câmara Legislativa;
- escolha de Brasil ou UF em um único controle de localidade;
- percentual de seções totalizadas e última carga oficial em destaque;
- candidaturas apresentadas com foto oficial, número, partido, votos e participação;
- lista em ordem de número de urna, sem ranking editorial por desempenho;
- ação “Todos os candidatos” para expandir disputas;
- resumo de votos brancos, nulos e válidos;
- nos cargos proporcionais: busca por candidatura, filtro por partido e filtro por situação oficial;
- resumos dos demais cargos para troca rápida de contexto;
- comparação simultânea de até quatro candidaturas do mesmo cargo e localidade;
- histórico carga a carga observado no navegador;
- matemática derivada exclusivamente da apuração efetivamente divulgada, sem probabilidades ou previsão do resultado.

## Cargos

- Presidente — código 0001 / eleição federal 6257
- Governador — código 0003 / eleição estadual 6259
- Senador — código 0005 / eleição estadual 6259
- Deputado Federal — código 0006 / eleição estadual 6259
- Deputado Estadual — código 0007 / eleição estadual 6259
- Deputado Distrital — código 0008 no Distrito Federal / eleição estadual 6259

## Atualização

O contexto aberto é consultado automaticamente em alta frequência. Quando a aba fica em segundo plano, o polling é pausado; em falhas consecutivas é aplicado backoff temporário.

Os resumos dos outros cargos usam uma cadência separada e mais lenta. Isso reduz requisições desnecessárias ao TSE e mantém a navegação responsiva.

## Fonte oficial

- Pleito: 3220 — 1º turno, 04/10/2026
- Eleição Geral Federal: 6257
- Eleições Gerais Estaduais: 6259
- Documentação técnica: https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados

O portal é independente e não possui vínculo institucional com o TSE.

## GitHub Pages

O repositório inclui `.github/workflows/pages.yml`. Cada push em `main` publica automaticamente a versão estática no GitHub Pages.

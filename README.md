# Deki

Agenda pessoal: o dia como uma linha que você percorre. Funciona no PC e no celular, sem conta e sem internet.

## Instalar (celular ou PC)

Abra **https://wagnerxm.github.io/deki/** e instale:

- Android (Chrome): menu ⋮ → "Instalar app" (ou "Adicionar à tela inicial").
- iPhone (Safari): compartilhar → "Adicionar à Tela de Início".
- PC (Chrome ou Edge): ícone de instalar na barra de endereço.

Depois de instalado, abre sem internet. Os dados ficam só no aparelho. Para atualizar o app publicado, faça commit na pasta e `git push`; o GitHub Pages republica em um minuto.

## Rodar no PC

Precisa só do Node (já instalado). Na pasta do Deki:

```
node server.js
```

Abra http://localhost:8787 no Chrome ou Edge. Para instalar como aplicativo, clique no ícone de instalar na barra de endereço.

## Instalar no celular

1. Deixe o `node server.js` rodando no PC.
2. O terminal mostra um endereço do tipo `http://192.168.x.x:8787`. Abra esse endereço no celular, na mesma rede Wi‑Fi.
3. No Android (Chrome): menu ⋮ → "Adicionar à tela inicial". No iPhone (Safari): compartilhar → "Adicionar à Tela de Início".

Depois de instalado, o app abre sem o PC ligado e os dados ficam no próprio aparelho. Segurar o ícone do app mostra os atalhos: Próxima tarefa, Nova tarefa e Monta meu dia.

## O dia a dia

- **Nova tarefa**: escreva como você fala, ou toque no microfone e fale. Exemplos: `sex 15h dentista, lembrar 1h antes, 40min`, `amanhã revisar planilha 45min`, `toda segunda academia 7h 1h`, `das 14h às 16h estudar hidrologia`, `estudar cálculo 2h intenso`.
- **Deslize o card** para a esquerda para iniciar, concluir ou adiar. **Toque no card** para editar, dividir em subpassos ou preencher a preparação de uma reunião.
- **Ritmo** (Leve, Normal, Intenso) muda a ordem em que as tarefas flexíveis são encaixadas nos vãos livres.
- **Energia do dia**: cada tarefa custa pontos conforme a duração e o ritmo. Passou do orçamento, o Deki avisa antes e oferece **Aliviar**.
- **Fixa** (cadeado) não se move. **Flexível** é encaixada automaticamente depois da hora atual. O que não for concluído **escorrega para o dia seguinte**.
- **Modo foco**: ao iniciar uma tarefa, abre o cronômetro em tela cheia com pausa e +5 min. Ao concluir, o Deki guarda quanto levou de verdade e passa a sugerir esse tempo nas próximas vezes ("costuma levar 50 min").
- **Reorganizar**: aparece na barra quando o dia atrasou. Reencaixa tudo a partir de agora e empurra para amanhã o que não cabe.
- **Preparar**: 15 minutos antes de um compromisso fixo, a barra oferece a preparação: anotações, link e a lista do que você quer resolver. Depois, **Registrar** transforma cada linha do que foi decidido em tarefa.
- **Monta meu dia**: propõe o dia inteiro a partir do pendente, do ritmo e da energia; você só aceita ou ajusta.
- **Rotinas**: Dia de obra, Dia de estudo e Dia de entrega vêm prontas. Dá para salvar qualquer dia como rotina nova.
- **Fechar dia**: resumo em três linhas, foco, sequência, mapa do mês e as três perguntas de 10 segundos que viram seu **diário** pesquisável. O que você escreve em "fica para amanhã" vira tarefa.
- **Revisão semanal** (menu, e lembrete no domingo à noite): sobras, tarefas em loop de adiamento, carga da próxima semana.
- **Projetos com prazo** (tela Semana): nome, prazo e etapas com minutos. O Deki espalha os blocos pelos dias usando o tempo livre e avisa se não fechar.

## Agenda e dados

- **Importar agenda (.ics)**: Google Agenda e Outlook exportam um link ou arquivo ICS. Os compromissos entram como fixos e as tarefas flexíveis se encaixam ao redor. Importar de novo só adiciona o que for novo.
  - Google: Configurações → sua agenda → "Endereço secreto no formato iCal".
  - Outlook: Configurações → Agenda → Agendas compartilhadas → Publicar → link ICS.
- **Vincular arquivo no OneDrive** (Chrome ou Edge no PC): escolha um `deki.json` dentro da pasta do OneDrive e o app grava nele a cada mudança. No celular, importe esse arquivo pelo menu.
- **Exportar / Importar JSON**: backup manual.
- **Lembretes**: ative no menu. Funcionam no PC e no Android com o app aberto ou instalado; no iPhone são limitados.

## Estrutura

```
index.html            tela
css/deki.css          visual base (paleta Meia-noite + Cobre) e efeitos
css/features.css      visual das funções avançadas
js/store.js           dados (localStorage), encaixe automático, energia, estimativas, projetos
js/parse.js           captura em português
js/app.js             telas, gestos, barra de ações, captura, edição, lembretes
js/features.js        foco, energia, replanejar, rotinas, preparação, diário, revisão semanal, voz, .ics, arquivo sincronizado, projetos, monta meu dia, modo compacto
manifest.webmanifest  instalação como app e atalhos
sw.js                 funcionamento offline
server.js             servidor local (também busca links .ics)
```

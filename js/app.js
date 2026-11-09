/* Deki · núcleo: topo com dias, linha do tempo com cards de aba e barra de tempo, captura, edição, menu, lembretes */
(function () {
  const S = Store;
  const $ = s => document.querySelector(s);
  const DOWS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const DOWL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const App = {
    S, $, DOWS, DOWL, MONTHS,
    sel: S.today(), view: 'day',
    hooks: { render: [], actions: [], day: [] },
    onRender(fn) { App.hooks.render.push(fn); },
    onActions(fn) { App.hooks.actions.push(fn); },
    onDay(fn) { App.hooks.day.push(fn); }
  };
  window.App = App;

  let cap = null, capOverride = {};
  let editingId = null;
  let daysDragged = false;
  const fired = new Set();

  /* ===== utilidades ===== */
  const fmtDur = m => m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}h${S.pad(m % 60)}` : `${m / 60}h`) : `${m} min`;
  const endOf = k => S.hm(Math.min(S.toMin(k.start) + k.dur, 24 * 60 - 1));
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const nowSec = () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };
  const clock = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h ? `${h}:${S.pad(m)}:${S.pad(ss)}` : `${S.pad(m)}:${S.pad(ss)}`; };
  const dateLabel = s => { const d = S.parseYmd(s); return `${DOWL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
  const shortDate = s => { if (s === S.today()) return 'hoje'; if (s === S.addDays(S.today(), 1)) return 'amanhã'; const d = S.parseYmd(s); return `${DOWS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const up = s => s.charAt(0).toUpperCase() + s.slice(1);
  let toastT;
  function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms || 2600); }
  function elapsedMin(k) { if (!k.startedAt) return 0; const paused = (k.pausedMs || 0) + (k.pausedAt ? Date.now() - k.pausedAt : 0); return (Date.now() - k.startedAt - paused) / 60000; }
  function progressOf(k) {
    if (k.status === 'concluida') return 100;
    if (k.status === 'andamento' && k.startedAt) return Math.min(99, Math.max(k.progress || 0, Math.round(elapsedMin(k) / k.dur * 100)));
    return k.progress || 0;
  }
  Object.assign(App, { fmtDur, endOf, nowMin, dateLabel, shortDate, esc, up, toast, progressOf, elapsedMin });

  /* ===== topo ===== */
  function renderTop() {
    const d = S.parseYmd(App.sel);
    $('#monthLabel').innerHTML = `${up(MONTHS[d.getMonth()])} ${d.getFullYear()}<i>▼</i>`;
    $('#viewTitle').textContent = App.view === 'week' ? 'Semana' : App.view === 'close' ? 'Fechamento' : (App.sel === S.today() ? 'Minhas tarefas' : dateLabel(App.sel));
    const days = $('#days'); days.innerHTML = '';
    for (let i = -3; i <= 3; i++) {
      const s = S.addDays(App.sel, i); const dd = S.parseYmd(s);
      const el = document.createElement('button');
      el.className = 'd' + (i === 0 ? ' on' : '') + (Math.abs(i) === 3 ? ' edge' : '') + (s === S.today() ? ' today' : '');
      el.innerHTML = `<b>${dd.getDate()}</b><span>${DOWS[dd.getDay()]}</span>${S.tasks(s).length ? '<u></u>' : ''}`;
      el.addEventListener('click', () => { if (daysDragged) return; App.sel = s; render(); });
      days.appendChild(el);
    }
    $('#ritPill').textContent = up(S.settings.ritmo) + ' ▾';
    ['navHoje', 'navSemana', 'navFechar'].forEach(id => $('#' + id).classList.remove('on'));
    $('#' + (App.view === 'week' ? 'navSemana' : App.view === 'close' ? 'navFechar' : 'navHoje')).classList.add('on');
  }

  /* ===== fases e barra de tempo ===== */
  function phaseOf(k, date) {
    if (k.status === 'concluida') return 'done';
    if (k.status === 'andamento') { if (k.pausedAt) return 'pausada'; return elapsedMin(k) > k.dur ? 'estourou' : 'andamento'; }
    if (k.status === 'adiada') return 'adiada';
    if (k.fixed) { const left = S.toMin(k.start) * 60 - nowSec(); return (date === S.today() && left > 0 && left <= 1800) ? 'breve' : 'fixa'; }
    return 'afazer';
  }
  function barOf(k, ph) {
    if (ph === 'done') return { w: 100, tx: '100%', cls: '' };
    if (ph === 'andamento') { const el = elapsedMin(k) * 60; return { w: Math.min(100, el / (k.dur * 60) * 100), tx: clock(k.dur * 60 - el), cls: 'run', dot: true }; }
    if (ph === 'pausada') return { w: progressOf(k), tx: 'pausada', cls: '' };
    if (ph === 'estourou') return { w: 100, tx: '+' + clock(elapsedMin(k) * 60 - k.dur * 60), cls: 'over' };
    if (ph === 'breve') { const left = S.toMin(k.start) * 60 - nowSec(); return { w: Math.max(0, left / 1800 * 100), tx: 'em ' + clock(left), cls: 'soon' }; }
    return { w: 0, tx: fmtDur(k.dur), cls: '' };
  }
  const TAB = { done: 'Concluída', andamento: 'Em andamento', pausada: 'Pausada', estourou: 'Estourou', breve: 'Começa em breve' };
  const ICO = { done: '✓', andamento: '▶', pausada: '❚❚', estourou: '!', adiada: '↪', fixa: '🔒', breve: '🔒', afazer: '≡' };

  /* ===== tela do dia: linha do tempo ===== */
  function slotHtml(k, date) {
    const ph = phaseOf(k, date); const b = barOf(k, ph);
    const tab = TAB[ph] || (ph === 'adiada' ? `Adiada ${k.postponed}x` : ph === 'fixa' ? (k.sourceId ? 'Agenda' : 'Fixa') : (k.auto ? 'Encaixada' : 'Agendada'));
    const bits = [k.start, ph === 'done' && k.actual ? `levou ${fmtDur(k.actual)}` : fmtDur(k.dur), k.note, k.effort !== 'normal' ? k.effort : '', k.postponed && ph !== 'done' ? (k.postponed === 1 ? 'veio de ontem' : '') : '', k.overflow ? 'passa do fim do dia' : '', k.remind != null && ph !== 'done' ? '🔔' : ''].filter(Boolean).join(' · ');
    const pin = ph === 'done' ? ['#6b6e7a', '✓', ''] : ph === 'andamento' || ph === 'pausada' || ph === 'estourou' ? ['var(--on)', '▶', 'dark'] : k.isNext ? ['var(--on)', '▶', 'dark go'] : ph === 'fixa' || ph === 'breve' ? ['#ffffff', '🔒', 'dark'] : ph === 'adiada' ? ['var(--f-adiada)', '↪', ''] : ['#4a4d59', '◆', ''];
    return `<div class="slot s-${ph}${ph === 'andamento' ? ' live' : ''}${ph === 'done' ? ' done' : ''}" data-id="${k.id}" data-ph="${ph}">
      <button class="pin ${pin[2]}" style="--pc:${pin[0]}" ${k.isNext ? 'data-a="start" title="Iniciar"' : ''}><i>${pin[1]}</i></button>
      <div class="tk">
        <div class="tab">${tab}</div>
        <div class="tbar ${b.cls}"><div class="tr"><i style="width:${b.w}%"></i>${b.dot ? `<u style="left:${b.w}%"></u>` : ''}</div><div class="tx">${b.tx}</div></div>
        <button class="ico" data-a="${ph === 'done' ? 'reopen' : 'complete'}" title="${ph === 'done' ? 'Reabrir' : 'Concluir'}"><b>${ICO[ph]}</b></button>
        <div class="txt"><h3>${esc(k.title)}</h3><p>${esc(bits)}</p></div>
        <div class="seal">100</div>
        <button class="more" title="Opções">⋮</button>
      </div>
    </div>`;
  }
  function renderDay() {
    const list = $('#list'); const t = S.today();
    const plan = S.plan(App.sel);
    if (App.sel === t && !plan.some(k => k.status === 'andamento')) { const nx = plan.find(k => (k.status === 'pendente' || k.status === 'adiada') && (!k.fixed || S.toMin(k.start) + k.dur > nowMin())); if (nx) nx.isNext = true; }
    const n = plan.length, done = plan.filter(k => k.status === 'concluida').length, mins = plan.reduce((a, k) => a + k.dur, 0);
    const heavy = S.energyDay(App.sel) > S.settings.energy;
    $('#sumText').innerHTML = n ? `<b>${n} tarefa${n > 1 ? 's' : ''}</b> · ${fmtDur(mins)}${done ? ` · ${done} concluída${done > 1 ? 's' : ''}` : ''}${heavy ? ' · <span class="warn">⚡ pesado</span>' : ''}` : '<b>Dia livre</b>';
    $('#empty').hidden = n > 0; list.hidden = n === 0;
    list.innerHTML = plan.map(k => slotHtml(k, App.sel)).join('');
    list.querySelectorAll('.slot').forEach(sl => {
      const id = sl.dataset.id;
      sl.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (b) { e.stopPropagation(); doAction(b.dataset.a, id, sl); } else openTask(id); });
    });
    App.hooks.day.forEach(fn => { try { fn(plan); } catch (e) {} });
  }
  /* atualiza só as barras, a cada segundo */
  function tickBars() {
    if (App.view !== 'day' || document.hidden) return;
    let changed = false;
    document.querySelectorAll('#list .slot').forEach(sl => {
      const k = S.get(sl.dataset.id); if (!k) return;
      const ph = phaseOf(k, App.sel);
      if (ph !== sl.dataset.ph) { changed = true; return; }
      if (ph !== 'andamento' && ph !== 'estourou' && ph !== 'breve') return;
      const b = barOf(k, ph);
      sl.querySelector('.tr i').style.width = b.w + '%'; const u = sl.querySelector('.tr u'); if (u) u.style.left = b.w + '%';
      sl.querySelector('.tx').textContent = b.tx;
    });
    if (changed && !document.querySelector('.slot.finishing')) renderDay();
  }

  /* ===== ações ===== */
  function doAction(a, id, el) {
    const k = S.get(id); if (!k) return;
    if (a === 'start') startTask(k);
    else if (a === 'complete') completeTask(k, el);
    else if (a === 'postpone') postponeTask(k);
    else if (a === 'reopen') { S.update(id, { status: 'pendente', progress: 0, doneAt: null, startedAt: null, pausedMs: 0, pausedAt: null }); toast('Reaberta'); render(); }
    else if (a === 'delete') { S.remove(id); toast('Excluída'); render(); }
    else if (a === 'plus15') { S.update(id, { dur: k.dur + 15 }); toast('+15 min'); render(); }
    else if (a === 'split') splitTask(k);
  }
  function startTask(k, opts) {
    S.state.tasks.forEach(o => { if (o.status === 'andamento' && o.id !== k.id) S.update(o.id, { status: 'pendente', progress: progressOf(o), pausedAt: null }); });
    const patch = { status: 'andamento', startedAt: Date.now() - (k.progress || 0) / 100 * k.dur * 60000, pausedMs: 0, pausedAt: null };
    if (!k.fixed || !k.start) patch.start = S.hm(nowMin());
    if (k.date !== S.today()) patch.date = S.today();
    S.update(k.id, patch); App.sel = S.today(); App.view = 'day'; render();
    if (!(opts && opts.quiet)) toast(`Iniciada: ${k.title}`);
    if (App.openFocus && !(opts && opts.noFocus)) App.openFocus(k.id);
  }
  function completeTask(k, el, opts) {
    if (!el) el = document.querySelector(`.slot[data-id="${k.id}"]`);
    const finish = () => {
      const planned = S.plan(k.date).find(x => x.id === k.id);
      const patch = { status: 'concluida', progress: 100, doneAt: Date.now(), pausedAt: null, start: k.start || (planned && planned.start) || S.hm(nowMin()) };
      if (k.startedAt) { const real = elapsedMin(k); if (real >= 1 && real <= k.dur * 4) S.recordActual(k, real); }
      S.update(k.id, patch);
      render(); toast(k.actual ? `Concluída · levou ${fmtDur(k.actual)}` : 'Concluída');
    };
    if (!el || (opts && opts.instant)) return finish();
    el.classList.add('finishing'); el.classList.remove('live');
    const tab = el.querySelector('.tab'); if (tab) tab.textContent = 'Concluída';
    const bar = el.querySelector('.tbar'); if (bar) { bar.className = 'tbar'; bar.querySelector('.tr i').style.width = '100%'; const u = bar.querySelector('.tr u'); if (u) u.remove(); bar.querySelector('.tx').textContent = '100%'; }
    const ic = el.querySelector('.ico b'); if (ic) ic.textContent = '✓';
    for (let i = 0; i < 9; i++) {
      const p = document.createElement('i'); p.className = 'pt'; const w = 3 + Math.random() * 5;
      p.style.cssText = `left:${10 + Math.random() * 80}%;top:${24 + Math.random() * 14}px;width:${w}px;height:${w + Math.random() * 4}px;animation-delay:${Math.random() * .25}s;background:${['#7CC79A', '#F7C514', '#F1E8DA'][i % 3]}`;
      el.appendChild(p);
    }
    setTimeout(finish, 750);
  }
  function postponeTask(k) {
    const patch = { date: S.addDays(k.date, 1), status: 'adiada', postponed: (k.postponed || 0) + 1, startedAt: null, pausedAt: null, pausedMs: 0 };
    if (!k.fixed) patch.start = null;
    S.update(k.id, patch); toast(`Adiada para ${shortDate(patch.date)}`); render();
  }
  function splitTask(k, lines) {
    if (lines && lines.length >= 2) {
      const n = lines.length; const each = Math.max(5, Math.round(k.dur / n / 5) * 5);
      S.update(k.id, { title: `${k.title} · ${lines[0]}`, dur: each });
      lines.slice(1).forEach((l, i) => S.add({ title: `${k.title} · ${l}`, note: k.note, date: k.date, dur: each, effort: k.effort, status: 'pendente', projectId: k.projectId, createdAt: k.createdAt + i + 1 }));
      toast(`Dividida em ${n} passos`); render(); return;
    }
    if (k.dur < 20) return toast('Curta demais para dividir');
    const half = Math.round(k.dur / 2 / 5) * 5;
    const base = k.title.replace(/\s*\(\d\/\d\)$/, '');
    S.update(k.id, { title: `${base} (1/2)`, dur: half });
    S.add({ title: `${base} (2/2)`, note: k.note, date: k.date, dur: k.dur - half, effort: k.effort, status: 'pendente', projectId: k.projectId, createdAt: k.createdAt + 1 });
    toast('Dividida em duas'); render();
  }
  function ripple() {}
  Object.assign(App, { startTask, completeTask, postponeTask, splitTask, doAction, ripple });

  /* ===== contexto para as funções avançadas (mantém os ganchos) ===== */
  function renderActions() {
    const today = S.today(); const running = S.state.tasks.find(k => k.status === 'andamento');
    const ctx = { view: App.view, sel: App.sel, today, running, plan: App.view === 'day' ? S.plan(App.sel) : null, next: null, soonFixed: null };
    App.hooks.actions.forEach(fn => { try { fn(ctx, [], ''); } catch (e) {} });
  }

  /* ===== semana ===== */
  function renderWeek() {
    const d = S.parseYmd(App.sel); const dow = (d.getDay() + 6) % 7;
    const monday = S.addDays(App.sel, -dow);
    const capMin = S.settings.capacity * 60;
    const wk = $('#week'); wk.innerHTML = '';
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const s = S.addDays(monday, i); const dd = S.parseYmd(s);
      const ts = S.tasks(s); const planned = ts.reduce((a, k) => a + k.dur, 0); const done = ts.filter(k => k.status === 'concluida').reduce((a, k) => a + k.dur, 0);
      total += planned;
      const el = document.createElement('div'); el.className = 'wd' + (s === App.sel ? ' sel' : '') + (planned > capMin ? ' over' : '');
      el.innerHTML = `<div class="n">${DOWS[dd.getDay()]}</div><div class="num">${dd.getDate()}</div><div class="col"><i style="height:${Math.min(100, planned / capMin * 100)}%"></i><u style="height:${Math.min(100, done / capMin * 100)}%"></u></div><div class="h">${planned ? fmtDur(planned) : '—'}</div>`;
      el.addEventListener('click', () => { App.sel = s; App.view = 'day'; render(); });
      wk.appendChild(el);
    }
    const a = S.parseYmd(monday), b = S.parseYmd(S.addDays(monday, 6));
    $('#wkRange').textContent = `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)}`;
    $('#wkLoad').textContent = `${fmtDur(total)} de ${S.settings.capacity * 7}h`;
    const nx = $('#next'); nx.innerHTML = '';
    const today = S.today(); let count = 0;
    for (let i = 0; i < 21 && count < 14; i++) {
      const s = S.addDays(today, i); if (!S.tasks(s).length) continue;
      S.plan(s).forEach(k => {
        if (count >= 14 || k.status === 'concluida') return; count++;
        const row = document.createElement('div'); row.className = 'nx';
        row.innerHTML = `<div class="t">${shortDate(s)} · ${k.start}</div><div>${esc(k.title)}<small>${fmtDur(k.dur)}${k.fixed ? ' · fixa' : ''}${k.remind != null ? ` · lembrete ${k.remind ? k.remind + ' min antes' : 'na hora'}` : ''}${k.postponed ? ` · adiada ${k.postponed}x` : ''}</small></div>`;
        row.addEventListener('click', () => { App.sel = s; App.view = 'day'; render(); });
        nx.appendChild(row);
      });
    }
    if (!count) nx.innerHTML = '<div class="nx"><div>Nada marcado nos próximos dias.</div></div>';
  }

  /* ===== fechamento ===== */
  function renderClose() {
    const ts = S.plan(App.sel); const done = ts.filter(k => k.status === 'concluida'); const pend = ts.filter(k => k.status !== 'concluida');
    const focus = done.reduce((a, k) => a + (k.actual || k.dur), 0);
    const st = S.stats();
    const pct = ts.length ? Math.round(done.length / ts.length * 100) : 0;
    const hours = {}; S.state.tasks.filter(k => k.status === 'concluida' && k.doneAt).forEach(k => { const h = new Date(k.doneAt).getHours(); hours[h] = (hours[h] || 0) + 1; });
    const bestH = Object.keys(hours).sort((a, b) => hours[b] - hours[a])[0];
    const over = done.filter(k => k.actual && k.actual > k.dur * 1.3);
    const sug = over.length ? `<b>${esc(over[0].title)}</b> levou ${fmtDur(over[0].actual)} em vez de ${fmtDur(over[0].dur)}. Da próxima vez o Deki já sugere o tempo real.` : bestH != null ? `Você costuma concluir mais perto das <b>${bestH}h</b>. Reserve esse horário para o que é intenso.` : `Comece amanhã no ritmo <b>intenso</b> com a tarefa mais difícil, enquanto a energia está alta.`;
    const lines = [
      ['Concluído', ts.length ? `Fechou <b>${done.length} de ${ts.length}</b> tarefas${done.length ? `, <b>${fmtDur(focus)}</b> de foco.` : '.'}` : 'Nenhuma tarefa marcada para este dia.'],
      ['Pendente', pend.length ? `<b>${pend.length}</b> ficou para depois: ${pend.map(k => esc(k.title)).slice(0, 3).join(', ')}${pend.length > 3 ? '…' : ''}. ${App.sel === S.today() ? 'O que não for concluído escorrega para amanhã.' : ''}` : 'Nada ficou para trás.'],
      ['Sugestão', sug]
    ];
    $('#closeLines').innerHTML = lines.map(([l, t]) => `<div class="line"><span class="l">${l}</span>${t}</div>`).join('');
    $('#closeStats').innerHTML = `<div class="stat"><b>${fmtDur(focus)}</b><small>foco</small></div><div class="stat"><b>${st.streak}</b><small>dias seguidos</small></div><div class="stat"><b>${pct}%</b><small>no planejado</small></div>`;
    const d = S.parseYmd(App.sel); const y = d.getFullYear(), m = d.getMonth();
    $('#heatTitle').textContent = `${up(MONTHS[m])} · dias com tarefas concluídas`;
    const first = new Date(y, m, 1); const off = (first.getDay() + 6) % 7; const n = new Date(y, m + 1, 0).getDate();
    const heat = $('#heat'); heat.innerHTML = '';
    for (let i = 0; i < off; i++) { const e = document.createElement('div'); e.style.visibility = 'hidden'; heat.appendChild(e); }
    for (let day = 1; day <= n; day++) {
      const s = S.ymd(new Date(y, m, day)); const c = (st.byDay[s] || {}).done || 0;
      const e = document.createElement('div'); e.className = (c ? 'h' + Math.min(4, c) : '') + (s === S.today() ? ' today' : ''); e.innerHTML = `<span>${day}</span>`;
      e.addEventListener('click', () => { App.sel = s; render(); });
      heat.appendChild(e);
    }
  }

  /* ===== captura ===== */
  function openCapture(date, preset) {
    capOverride = {}; cap = null;
    const sh = $('#sheetCapture'); sh.hidden = false;
    const inp = $('#capInput'); inp.value = preset || ''; inp.dataset.date = date || App.sel;
    renderChips(); setTimeout(() => inp.focus(), 50);
  }
  function currentCap() {
    const text = $('#capInput').value.trim();
    const base = text ? Parse.parse(text) : { title: '', date: $('#capInput').dataset.date, start: null, dur: 30, remind: null, fixed: false, effort: 'normal', repeat: null, note: '' };
    if (!text || !/hoje|amanh|\d\/|\b(seg|ter|qua|qui|sex|s[aá]b|dom)/i.test(text)) base.date = capOverride.date || $('#capInput').dataset.date || base.date;
    const c = Object.assign({}, base, capOverride);
    c.suggest = c.title ? S.suggestDur(c.title) : null;
    return c;
  }
  function renderChips() {
    cap = currentCap();
    const remTxt = cap.remind == null ? '—' : cap.remind ? (cap.remind >= 60 ? `${cap.remind / 60}h antes` : `${cap.remind} min antes`) : 'na hora';
    const repTxt = !cap.repeat ? '—' : cap.repeat.kind === 'daily' ? 'todo dia' : `toda ${cap.repeat.dow != null ? DOWS[cap.repeat.dow] : 'semana'}`;
    /* prévia: o card exatamente como vai aparecer na linha do tempo */
    const ph = cap.fixed ? 'fixa' : 'afazer';
    const when = shortDate(cap.date);
    const tab = `${cap.fixed ? 'Fixa' : 'Encaixada'} · ${when}`;
    const bits = [cap.start || 'horário livre', fmtDur(cap.dur), cap.note, cap.effort !== 'normal' ? cap.effort : '', cap.remind != null ? '🔔' : '', cap.repeat ? '↻ ' + repTxt : ''].filter(Boolean).join(' · ');
    $('#capPrev').innerHTML = `<div class="slot s-${ph} ${cap.title ? '' : 'empty-t'}"><div class="tk"><div class="tab">${esc(tab)}</div><div class="tbar"><div class="tr"><i></i></div><div class="tx">${fmtDur(cap.dur)}</div></div><div class="ico"><b>${cap.fixed ? '🔒' : '≡'}</b></div><div class="txt"><h3>${esc(cap.title || 'Sua tarefa')}</h3><p>${esc(bits)}</p></div><div class="more">⋮</div></div></div>`;
    /* detalhes: cada um é um botão para corrigir */
    const box = $('#capChips'); box.innerHTML = '';
    const chip = (label, val, fn, cls) => { const c = document.createElement('button'); c.type = 'button'; c.className = 'chip ' + (cls || '') + (val === '—' ? ' off' : ''); c.innerHTML = `${label}<u>${esc(val)}</u>`; c.addEventListener('click', fn); box.appendChild(c); };
    chip('Dia', when, () => pickDate(v => { capOverride.date = v; renderChips(); }, cap.date));
    chip('Hora', cap.start || 'livre', () => pickTime(v => { capOverride.start = v || null; if (!v) capOverride.fixed = false; renderChips(); }, cap.start));
    chip('Duração', fmtDur(cap.dur), () => { const cyc = [15, 30, 45, 60, 90, 120, 180]; capOverride.dur = cyc[(cyc.indexOf(cap.dur) + 1) % cyc.length] || 30; renderChips(); });
    chip('Lembrete', remTxt, () => { const cyc = [null, 0, 10, 30, 60]; capOverride.remind = cyc[(cyc.indexOf(cap.remind) + 1) % cyc.length]; renderChips(); });
    chip('Tipo', cap.fixed ? 'fixa' : 'flexível', () => { capOverride.fixed = !cap.fixed; if (capOverride.fixed && !cap.start) capOverride.start = '09:00'; renderChips(); });
    chip('Ritmo', cap.effort, () => { const cyc = ['leve', 'normal', 'intenso']; capOverride.effort = cyc[(cyc.indexOf(cap.effort) + 1) % 3]; renderChips(); });
    chip('Repetir', repTxt, () => { const cyc = [null, { kind: 'daily' }, { kind: 'weekly', dow: S.parseYmd(cap.date).getDay() }]; const i = !cap.repeat ? 0 : cap.repeat.kind === 'daily' ? 1 : 2; capOverride.repeat = cyc[(i + 1) % 3]; renderChips(); });
    if (cap.suggest && cap.suggest.median !== cap.dur) chip('Costuma levar', fmtDur(cap.suggest.median), () => { capOverride.dur = cap.suggest.median; renderChips(); }, 'learn');
  }
  function saveCapture() {
    const c = currentCap();
    if (!c.title) { toast('Escreva o que é a tarefa'); return; }
    const mk = date => S.add({ title: c.title, note: c.note, date, start: c.start, dur: c.dur, fixed: c.fixed, effort: c.effort, remind: c.remind });
    let n = 1; mk(c.date);
    if (c.repeat) { const step = c.repeat.kind === 'daily' ? 1 : 7; const times = c.repeat.kind === 'daily' ? 13 : 7; for (let i = 1; i <= times; i++) mk(S.addDays(c.date, i * step)); n += times; }
    $('#sheetCapture').hidden = true;
    toast(n > 1 ? `${n} ocorrências de "${c.title}"` : `Adicionada: ${c.title} · ${shortDate(c.date)}${c.start ? ' ' + c.start : ''}`);
    App.sel = c.date; App.view = 'day';
    render();
  }
  function pickDate(fn, cur) { const i = document.createElement('input'); i.type = 'date'; i.value = cur || App.sel; i.style.cssText = 'position:fixed;opacity:0;left:0;top:0'; document.body.appendChild(i); i.addEventListener('change', () => { if (i.value) fn(i.value); i.remove(); }); i.addEventListener('blur', () => setTimeout(() => i.remove(), 300)); i.focus(); try { i.showPicker(); } catch (e) {} }
  function pickTime(fn, cur) { const i = document.createElement('input'); i.type = 'time'; i.value = cur || '09:00'; i.style.cssText = 'position:fixed;opacity:0;left:0;top:0'; document.body.appendChild(i); i.addEventListener('change', () => { fn(i.value); i.remove(); }); i.addEventListener('blur', () => setTimeout(() => i.remove(), 300)); i.focus(); try { i.showPicker(); } catch (e) {} }
  Object.assign(App, { openCapture, renderChips, pickDate, pickTime });

  /* ===== detalhe da tarefa ===== */
  function openTask(id) {
    const k = S.get(id); if (!k) return; editingId = id;
    $('#tTitle').value = k.title; $('#tNote').value = k.note || ''; $('#tDate').value = k.date; $('#tStart').value = k.start || ''; $('#tDur').value = k.dur; $('#tRemind').value = k.remind == null ? '' : k.remind;
    $('#tSplit').value = ''; $('#tSplitBox').open = false;
    const p = k.prep || {}; $('#tPrepNote').value = p.note || ''; $('#tPrepLink').value = p.link || ''; $('#tPrepList').value = p.checklist || ''; $('#tPrepBox').open = !!(p.note || p.link || p.checklist);
    const acts = $('#tActions'); acts.innerHTML = '';
    const mk = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', () => { $('#sheetTask').hidden = true; fn(); }); acts.appendChild(b); };
    if (k.status === 'andamento') { mk('✓ Concluir', 'primary', () => completeTask(k)); mk('◎ Foco', '', () => App.openFocus && App.openFocus(k.id)); mk('+15 min', '', () => doAction('plus15', k.id)); mk('→ Adiar', '', () => postponeTask(k)); }
    else if (k.status !== 'concluida') { mk('▶ Iniciar', 'primary', () => startTask(k)); mk('✓ Concluir', '', () => completeTask(k)); mk('→ Adiar', '', () => postponeTask(k)); mk('⁞ Dividir', '', () => splitTask(k)); if (k.fixed && App.openPrep) mk('Preparar', '', () => App.openPrep(k.id)); }
    else { mk('↺ Reabrir', '', () => doAction('reopen', k.id)); }
    renderTaskChips(Object.assign({}, k)); $('#sheetTask').hidden = false;
  }
  function renderTaskChips(k) {
    const box = $('#tChips'); box.innerHTML = '';
    const chip = (cls, text, fn) => { const c = document.createElement('div'); c.className = 'chip ' + cls; c.textContent = text; c.addEventListener('click', fn); box.appendChild(c); };
    chip(k.fixed ? 'ok' : '', k.fixed ? '🔒 fixa' : '↔ flexível', () => { k.fixed = !k.fixed; if (k.fixed && !$('#tStart').value) $('#tStart').value = '09:00'; renderTaskChips(k); });
    chip(k.effort !== 'normal' ? 'ok' : '', `ritmo ${k.effort}`, () => { const cyc = ['leve', 'normal', 'intenso']; k.effort = cyc[(cyc.indexOf(k.effort) + 1) % 3]; renderTaskChips(k); });
    const st = { pendente: 'pendente', andamento: 'em andamento', concluida: 'concluída', adiada: 'adiada' };
    chip('ok', `estado: ${st[k.status]}`, () => { const cyc = ['pendente', 'andamento', 'concluida']; k.status = cyc[(cyc.indexOf(k.status) + 1) % 3]; if (k.status === 'andamento') k.startedAt = Date.now(); if (k.status === 'concluida') { k.progress = 100; k.doneAt = Date.now(); } if (k.status === 'pendente') { k.progress = 0; } renderTaskChips(k); });
    const sg = S.suggestDur(k.title); if (sg) chip('learn', `costuma levar ${fmtDur(sg.median)} (${sg.n}x) · usar`, () => { $('#tDur').value = sg.median; });
    chip('', `⚡ ${S.energyOf(Object.assign({}, k, { dur: +$('#tDur').value || k.dur }))} de energia`, () => {});
    box.dataset.fixed = k.fixed; box.dataset.effort = k.effort; box.dataset.status = k.status; box.dataset.startedAt = k.startedAt || ''; box.dataset.progress = k.progress || 0; box.dataset.doneAt = k.doneAt || '';
  }
  function saveTask() {
    const k = S.get(editingId); if (!k) return;
    const box = $('#tChips');
    const start = $('#tStart').value || null;
    const prep = { note: $('#tPrepNote').value.trim(), link: $('#tPrepLink').value.trim(), checklist: $('#tPrepList').value.trim(), checked: (k.prep && k.prep.checked) || [] };
    S.update(k.id, {
      title: $('#tTitle').value.trim() || k.title, note: $('#tNote').value.trim(), date: $('#tDate').value || k.date, start, dur: Math.max(5, +$('#tDur').value || k.dur),
      remind: $('#tRemind').value === '' ? null : +$('#tRemind').value, fixed: box.dataset.fixed === 'true' && !!start, effort: box.dataset.effort, status: box.dataset.status,
      startedAt: box.dataset.startedAt ? +box.dataset.startedAt : null, progress: +box.dataset.progress, doneAt: box.dataset.doneAt ? +box.dataset.doneAt : null,
      prep: (prep.note || prep.link || prep.checklist) ? prep : null
    });
    const lines = $('#tSplit').value.split('\n').map(l => l.trim()).filter(Boolean);
    $('#sheetTask').hidden = true;
    if (lines.length >= 2) splitTask(S.get(k.id), lines); else { toast('Salva'); render(); }
  }
  Object.assign(App, { openTask, saveTask });

  /* ===== menus ===== */
  function openMenu() { $('#sStart').value = S.settings.dayStart; $('#sEnd').value = S.settings.dayEnd; $('#sCap').value = S.settings.capacity; $('#sEnergy').value = S.settings.energy; $('#mSamples').hidden = !S.settings.samples; $('#sheetMenu').hidden = false; }
  function bindMenu() {
    $('#navMais').addEventListener('click', openMenu);
    $('#btnMenu').addEventListener('click', openMenu);
    $('#btnDay').addEventListener('click', () => { $('#dayTitle').textContent = up(shortDate(App.sel)); $('#sheetDay').hidden = false; });
    $('#dMonta').addEventListener('click', () => { closeSheets(); if (App.openAssist) App.openAssist(App.sel); });
    $('#dReplan').addEventListener('click', () => { closeSheets(); $('#mReplan').click(); });
    $('#dRotinas').addEventListener('click', () => { closeSheets(); if (App.openTemplates) App.openTemplates(); });
    $('#dHoje').addEventListener('click', () => { closeSheets(); goToday(); });
    $('#mClose').addEventListener('click', () => { App.view = 'close'; closeSheets(); render(); });
    $('#mToday').addEventListener('click', () => { closeSheets(); goToday(); });
    $('#mNotify').addEventListener('click', async () => { if (!('Notification' in window)) return toast('Este navegador não tem notificações'); const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Lembretes ativados' : 'Lembretes não autorizados'); });
    $('#mExport').addEventListener('click', () => { const blob = new Blob([S.exportJson()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `deki-${S.today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Exportado'); });
    $('#mImport').addEventListener('click', () => $('#fileImport').click());
    $('#fileImport').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { S.importJson(t); toast('Importado'); closeSheets(); render(); } catch (err) { toast('Arquivo inválido'); } }); e.target.value = ''; });
    $('#mSamples').addEventListener('click', () => { S.removeSamples(); toast('Exemplos removidos'); closeSheets(); render(); });
    ['sStart', 'sEnd', 'sCap', 'sEnergy'].forEach(id => $('#' + id).addEventListener('change', () => { S.setSettings({ dayStart: $('#sStart').value || '07:00', dayEnd: $('#sEnd').value || '22:00', capacity: Math.max(1, +$('#sCap').value || 8), energy: Math.max(3, +$('#sEnergy').value || 12) }); render(); }));
  }
  function closeSheets() { document.querySelectorAll('.sheet').forEach(s => s.hidden = true); }
  function goToday() { App.sel = S.today(); App.view = 'day'; render(); }
  App.closeSheets = closeSheets; App.goToday = goToday; App.openTask = openTask; App.phaseOf = phaseOf;

  /* ===== lembretes e relógio ===== */
  function tick() {
    const t = S.today();
    if (S.state.lastOpen !== t) { const n = S.slip(); if (n) toast(`${n} tarefa${n > 1 ? 's' : ''} escorregou para hoje`); App.sel = t; render(); }
    const plan = S.plan(t); const now = nowMin();
    plan.forEach(k => {
      if (k.remind == null || !k.start || k.status === 'concluida') return;
      const at = S.toMin(k.start) - k.remind; const key = k.id + ':' + t;
      if (now >= at && now < at + 2 && !fired.has(key)) {
        fired.add(key);
        const msg = k.remind ? `${k.title} em ${k.remind} min (${k.start})` : `${k.title} agora (${k.start})`;
        if ('Notification' in window && Notification.permission === 'granted') { try { new Notification('Deki', { body: msg, icon: 'icons/icon-192.png' }); } catch (e) {} }
        toast('🔔 ' + msg);
      }
    });
    App.hooks.render.forEach(fn => { try { fn('tick'); } catch (e) {} });
  }

  /* ===== render geral ===== */
  function render() {
    renderTop();
    $('#viewDay').hidden = App.view !== 'day'; $('#viewWeek').hidden = App.view !== 'week'; $('#viewClose').hidden = App.view !== 'close';
    if (App.view === 'day') renderDay(); else if (App.view === 'week') renderWeek(); else renderClose();
    renderActions();
    App.hooks.render.forEach(fn => { try { fn('render'); } catch (e) { console.error(e); } });
  }
  App.render = render; App.renderActions = renderActions;

  /* ===== eventos ===== */
  function bind() {
    $('#ritPill').addEventListener('click', () => { const cyc = ['leve', 'normal', 'intenso']; S.setSettings({ ritmo: cyc[(cyc.indexOf(S.settings.ritmo) + 1) % 3] }); render(); toast(`Ritmo ${S.settings.ritmo}`); });
    $('#monthLabel').addEventListener('click', () => pickDate(v => { App.sel = v; render(); }, App.sel));
    let x0 = null; const days = $('#days');
    days.addEventListener('pointerdown', e => { x0 = e.clientX; daysDragged = false; });
    days.addEventListener('pointerup', e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) { daysDragged = true; App.sel = S.addDays(App.sel, dx < 0 ? 7 : -7); render(); setTimeout(() => daysDragged = false, 50); } });
    $('#navHoje').addEventListener('click', goToday);
    $('#navSemana').addEventListener('click', () => { App.view = 'week'; render(); });
    $('#navFechar').addEventListener('click', () => { App.view = 'close'; render(); });
    $('#fab').addEventListener('click', () => openCapture(App.sel));
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
    $('#capInput').addEventListener('input', renderChips);
    $('#capInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveCapture(); });
    $('#capSave').addEventListener('click', saveCapture);
    $('#tSave').addEventListener('click', saveTask);
    $('#tDur').addEventListener('input', () => { const k = S.get(editingId); if (k) renderTaskChips(Object.assign({}, k, { fixed: $('#tChips').dataset.fixed === 'true', effort: $('#tChips').dataset.effort, status: $('#tChips').dataset.status })); });
    $('#tDelete').addEventListener('click', () => { if (editingId) { S.remove(editingId); $('#sheetTask').hidden = true; toast('Excluída'); render(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); if (App.view === 'day') renderDay(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheets(); });
    bindMenu();
  }

  /* ===== início ===== */
  const slipped = S.slip();
  bind();
  App.boot = () => { render(); if (slipped) toast(`${slipped} tarefa${slipped > 1 ? 's' : ''} escorregou para hoje`); setInterval(tick, 30000); setInterval(tickBars, 1000); };
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();

/* Deki · funções avançadas: foco, energia, replanejar, rotinas, preparação, diário, revisão semanal, voz, agenda .ics, arquivo sincronizado, projetos, monta meu dia, modo compacto */
(function () {
  const S = Store, A = App, $ = A.$;
  const { fmtDur, shortDate, esc, toast } = A;
  const q = new URLSearchParams(location.search);

  /* =========================================================
     1 · Orçamento de energia
     ========================================================= */
  function renderEnergy() {
    const el = $('#energy'); if (!el) return;
    const used = S.energyDay(A.sel), budget = S.settings.energy;
    const pct = Math.min(100, used / budget * 100);
    const over = used > budget;
    el.className = 'energy' + (over ? ' over' : pct > 80 ? ' high' : '');
    el.innerHTML = `<div class="en-row"><span>⚡ Energia do dia</span><b>${String(used).replace('.', ',')} de ${budget}</b></div><div class="en-bar"><i style="width:${pct}%"></i></div>` +
      (over ? `<div class="en-warn">Dia pesado demais. <button class="lnk" id="enRelief">Aliviar</button> move o que pesa para amanhã, ou peça <button class="lnk" id="enAssist">Monta meu dia</button>.</div>` : '');
    const r = $('#enRelief'); if (r) r.addEventListener('click', relieve);
    const a = $('#enAssist'); if (a) a.addEventListener('click', () => openAssist(A.sel));
  }
  function relieve() {
    const budget = S.settings.energy; let used = S.energyDay(A.sel); let n = 0;
    const cand = S.tasks(A.sel).filter(k => !k.fixed && k.status !== 'concluida' && k.status !== 'andamento' && k.status !== 'adiada').sort((a, b) => S.energyOf(b) - S.energyOf(a) || b.createdAt - a.createdAt);
    for (const k of cand) { if (used <= budget) break; S.update(k.id, { date: S.addDays(A.sel, 1), start: k.fixed ? k.start : null }); used -= S.energyOf(k); n++; }
    toast(n ? `${n} tarefa${n > 1 ? 's' : ''} movida${n > 1 ? 's' : ''} para ${shortDate(S.addDays(A.sel, 1))}` : 'Nada para mover'); A.render();
  }
  A.onDay(renderEnergy);

  /* =========================================================
     2 · Modo foco com cronômetro
     ========================================================= */
  let focusId = null, focusTimer = null;
  function openFocus(id) {
    const k = S.get(id); if (!k) return;
    focusId = id; $('#focus').hidden = false; $('#fTitle').textContent = k.title; $('#fNote').textContent = k.note || '';
    const sg = S.suggestDur(k.title);
    $('#fLearn').textContent = sg ? `Você costuma levar ${fmtDur(sg.median)} nisso (${sg.n} vez${sg.n > 1 ? 'es' : ''}). Planejado: ${fmtDur(k.dur)}.` : `Primeira vez cronometrando. O Deki vai aprender quanto isso leva de verdade.`;
    tickFocus(); clearInterval(focusTimer); focusTimer = setInterval(tickFocus, 1000);
    try { if (document.documentElement.requestFullscreen && window.innerWidth < 600) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  }
  function closeFocus() { $('#focus').hidden = true; clearInterval(focusTimer); focusId = null; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} }
  function tickFocus() {
    const k = S.get(focusId); if (!k || k.status !== 'andamento') return closeFocus();
    const el = A.elapsedMin(k); const rem = k.dur - el;
    const abs = Math.abs(rem); const mm = Math.floor(abs), ss = Math.floor((abs - mm) * 60);
    $('#fTime').textContent = `${rem < 0 ? '+' : ''}${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    $('#fSub').textContent = k.pausedAt ? 'pausado' : rem < 0 ? 'além do planejado' : 'restantes';
    const pct = Math.min(100, el / k.dur * 100);
    $('#fRing').style.background = `conic-gradient(var(--on) ${pct}%, #27323D ${pct}%)`;
    $('#fRing').classList.toggle('over', rem < 0); $('#fRing').classList.toggle('paused', !!k.pausedAt);
    $('#fPause').textContent = k.pausedAt ? 'Retomar' : 'Pausar';
  }
  $('#fExit').addEventListener('click', () => { closeFocus(); A.render(); });
  $('#fPause').addEventListener('click', () => { const k = S.get(focusId); if (!k) return; if (k.pausedAt) S.update(k.id, { pausedMs: (k.pausedMs || 0) + (Date.now() - k.pausedAt), pausedAt: null }); else S.update(k.id, { pausedAt: Date.now() }); tickFocus(); });
  $('#fPlus').addEventListener('click', () => { const k = S.get(focusId); if (k) { S.update(k.id, { dur: k.dur + 5 }); tickFocus(); toast('+5 min'); } });
  $('#fDone').addEventListener('click', () => { const k = S.get(focusId); closeFocus(); if (k) { A.render(); A.completeTask(k); } });
  A.openFocus = openFocus;

  /* =========================================================
     3 · Replanejar em um toque
     ========================================================= */
  function replan() {
    const r = S.replan(S.today());
    toast(r.moved.length ? `Reorganizado: ${r.kept} hoje, ${r.moved.length} para amanhã (${r.moved.map(k => k.title).slice(0, 2).join(', ')}${r.moved.length > 2 ? '…' : ''})` : `Reorganizado: ${r.kept} tarefa${r.kept !== 1 ? 's' : ''} reencaixada${r.kept !== 1 ? 's' : ''} a partir de agora`, 4000);
    A.render();
  }
  function behind(plan) {
    const now = A.nowMin();
    return plan.some(k => k.overflow) || plan.some(k => !k.fixed && !k.auto && (k.status === 'pendente' || k.status === 'adiada') && S.toMin(k.start) + k.dur < now) || S.energyDay(S.today()) > S.settings.energy;
  }
  A.onActions((ctx, btns) => {
    if (ctx.view === 'day' && ctx.sel === ctx.today && !ctx.running && ctx.plan && behind(ctx.plan)) { btns.splice(1, 0, ['', 'Reorganizar', replan]); return { btns: btns.slice(0, 4) }; }
  });
  $('#mReplan').addEventListener('click', () => { A.closeSheets(); A.sel = S.today(); A.view = 'day'; replan(); });

  /* =========================================================
     4 · Rotinas por modelo
     ========================================================= */
  function openTemplates() {
    const box = $('#tplList'); box.innerHTML = '';
    S.state.templates.forEach(t => {
      const total = t.items.reduce((a, i) => a + i.dur, 0);
      const el = document.createElement('div'); el.className = 'tpl-item';
      el.innerHTML = `<div class="tpl-h"><b>${esc(t.name)}</b><small>${t.items.length} tarefas · ${fmtDur(total)}</small></div><div class="tpl-l">${t.items.map(i => `${i.start ? i.start + ' ' : ''}${esc(i.title)} (${fmtDur(i.dur)})`).join(' · ')}</div><div class="tpl-b"><button class="btn primary" data-apply="${t.id}">Aplicar em ${shortDate(A.sel)}</button><button class="btn ghost" data-del="${t.id}">Excluir</button></div>`;
      box.appendChild(el);
    });
    box.querySelectorAll('[data-apply]').forEach(b => b.addEventListener('click', () => applyTemplate(b.dataset.apply, A.sel)));
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { S.state.templates = S.state.templates.filter(t => t.id !== b.dataset.del); S.save(); openTemplates(); }));
    $('#sheetTemplates').hidden = false;
  }
  function applyTemplate(id, date) {
    const t = S.state.templates.find(x => x.id === id); if (!t) return;
    t.items.forEach((i, n) => S.add({ title: i.title, date, start: i.start || null, dur: i.dur, fixed: !!(i.fixed && i.start), effort: i.effort || 'normal', createdAt: Date.now() + n }));
    A.closeSheets(); toast(`Rotina "${t.name}" aplicada em ${shortDate(date)}`); A.view = 'day'; A.render();
  }
  $('#tplFromDay').addEventListener('click', () => {
    const ts = S.tasks(A.sel); if (!ts.length) return toast('O dia está vazio');
    const name = prompt('Nome da rotina:', `Dia como ${shortDate(A.sel)}`); if (!name) return;
    S.state.templates.push({ id: S.uid(), name, items: ts.map(k => ({ title: k.title.replace(/\s*\(\d\/\d\)$/, ''), dur: k.dur, effort: k.effort, start: k.fixed ? k.start : null, fixed: k.fixed })) });
    S.save(); openTemplates(); toast('Rotina salva');
  });
  $('#mTemplates').addEventListener('click', () => { A.closeSheets(); openTemplates(); });
  $('#emptyRoutine').addEventListener('click', openTemplates);
  A.openTemplates = openTemplates;

  /* =========================================================
     5 · Pré-reunião automática e registro
     ========================================================= */
  let prepId = null;
  function openPrep(id) {
    const k = S.get(id); if (!k) return; prepId = id;
    const p = k.prep || { note: '', link: '', checklist: '', checked: [] };
    $('#pTitle').textContent = `${k.title} · ${k.start || ''}`;
    $('#pNote').textContent = p.note || 'Sem anotações de preparação. Toque no card para adicionar.';
    $('#pLink').innerHTML = p.link ? `<a class="p-link" href="${esc(p.link)}" target="_blank" rel="noopener">Abrir link ↗</a>` : '';
    const items = (p.checklist || '').split('\n').map(s => s.trim()).filter(Boolean);
    const list = $('#pList'); list.innerHTML = items.length ? '' : '<div class="hint">Nenhum item para resolver. Toque no card e preencha "Preparação".</div>';
    items.forEach((it, i) => {
      const row = document.createElement('label'); row.className = 'ck' + ((p.checked || []).includes(i) ? ' on' : '');
      row.innerHTML = `<input type="checkbox" ${(p.checked || []).includes(i) ? 'checked' : ''}><span>${esc(it)}</span>`;
      row.querySelector('input').addEventListener('change', e => { const set = new Set(p.checked || []); e.target.checked ? set.add(i) : set.delete(i); p.checked = [...set]; S.update(k.id, { prep: p }); row.classList.toggle('on', e.target.checked); });
      list.appendChild(row);
    });
    $('#pRegister').value = '';
    $('#sheetPrep').hidden = false;
  }
  $('#pSaveRegister').addEventListener('click', () => {
    const lines = $('#pRegister').value.split('\n').map(s => s.trim()).filter(Boolean); if (!lines.length) return toast('Escreva o que foi decidido');
    const k = S.get(prepId);
    lines.forEach(l => { const p = Parse.parse(l); S.add({ title: p.title, note: p.note || (k ? `de: ${k.title}` : ''), date: p.date, start: p.start, dur: p.dur, fixed: p.fixed, effort: p.effort, remind: p.remind }); });
    A.closeSheets(); toast(`${lines.length} tarefa${lines.length > 1 ? 's' : ''} criada${lines.length > 1 ? 's' : ''} a partir da reunião`); A.render();
  });
  A.onDay(plan => {
    document.querySelectorAll('.slot').forEach(sl => {
      const k = S.get(sl.dataset.id); if (!k || !k.fixed) return;
      const m = sl.querySelector('.more'); if (m) { m.title = 'Preparar'; m.addEventListener('click', e => { e.stopPropagation(); openPrep(k.id); }); }
    });
  });
  A.openPrep = openPrep;

  /* =========================================================
     6 · Fechamento que conversa + diário pesquisável
     ========================================================= */
  function loadJournal() {
    const j = S.state.journal.find(e => e.date === A.sel) || {};
    $('#jTravou').value = j.travou || ''; $('#jSurpreendeu').value = j.surpreendeu || ''; $('#jAmanha').value = j.amanha || '';
  }
  $('#jSave').addEventListener('click', () => {
    const e = { date: A.sel, travou: $('#jTravou').value.trim(), surpreendeu: $('#jSurpreendeu').value.trim(), amanha: $('#jAmanha').value.trim(), at: Date.now() };
    if (!e.travou && !e.surpreendeu && !e.amanha) return toast('Responda pelo menos uma pergunta');
    S.state.journal = S.state.journal.filter(x => x.date !== A.sel); S.state.journal.push(e); S.save();
    let msg = 'Diário guardado';
    if (e.amanha && !S.tasks(S.addDays(A.sel, 1)).some(k => S.norm(k.title) === S.norm(e.amanha))) { const p = Parse.parse(e.amanha); S.add({ title: p.title, note: 'do fechamento', date: S.addDays(A.sel, 1), start: p.start, dur: p.dur, fixed: p.fixed, effort: p.effort }); msg += ' · "' + p.title + '" virou tarefa de amanhã'; }
    toast(msg, 3500); A.render();
  });
  function openDiary() {
    $('#diarySearch').value = ''; renderDiary(); $('#sheetDiary').hidden = false;
  }
  function renderDiary() {
    const qs = S.norm($('#diarySearch').value);
    const box = $('#diaryList'); box.innerHTML = '';
    const list = S.state.journal.slice().sort((a, b) => b.date.localeCompare(a.date)).filter(e => !qs || S.norm([e.travou, e.surpreendeu, e.amanha].join(' ')).includes(qs));
    if (!list.length) { box.innerHTML = '<div class="hint">Nada no diário ainda. Responda as três perguntas no Fechamento do dia.</div>'; return; }
    list.forEach(e => {
      const st = S.stats().byDay[e.date] || { done: 0, total: 0 };
      const el = document.createElement('div'); el.className = 'dj';
      el.innerHTML = `<div class="dj-h"><b>${A.dateLabel(e.date)}</b><small>${st.done} de ${st.total} concluídas</small></div>${e.travou ? `<div><i>travou</i>${esc(e.travou)}</div>` : ''}${e.surpreendeu ? `<div><i>surpreendeu</i>${esc(e.surpreendeu)}</div>` : ''}${e.amanha ? `<div><i>amanhã</i>${esc(e.amanha)}</div>` : ''}`;
      el.addEventListener('click', () => { A.sel = e.date; A.view = 'close'; A.closeSheets(); A.render(); });
      box.appendChild(el);
    });
  }
  $('#diarySearch').addEventListener('input', renderDiary);
  $('#jDiary').addEventListener('click', openDiary);
  $('#mDiary').addEventListener('click', () => { A.closeSheets(); openDiary(); });
  A.onRender(() => { if (A.view === 'close') loadJournal(); });

  /* =========================================================
     7 · Revisão semanal guiada
     ========================================================= */
  let wkStep = 0;
  function openWeekly() { wkStep = 0; renderWeekly(); $('#sheetWeekly').hidden = false; }
  function renderWeekly() {
    const t = S.today(); const steps = ['Sobras', 'Repetidas', 'Próxima semana', 'Pronto'];
    $('#wkSteps').innerHTML = steps.map((s, i) => `<span class="${i === wkStep ? 'on' : i < wkStep ? 'done' : ''}">${i + 1} ${s}</span>`).join('');
    const body = $('#wkBody'); body.innerHTML = '';
    const row = (k, buttons) => { const el = document.createElement('div'); el.className = 'wk-row'; el.innerHTML = `<div><b>${esc(k.title)}</b><small>${shortDate(k.date)} · ${fmtDur(k.dur)}${k.postponed ? ` · adiada ${k.postponed}x` : ''}</small></div><div class="wk-b">${buttons.map(([l, a]) => `<button data-a="${a}">${l}</button>`).join('')}</div>`; el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { act(k, b.dataset.a); renderWeekly(); })); return el; };
    const act = (k, a) => { if (a === 'rm') S.remove(k.id); else if (a === 'tm') S.update(k.id, { date: S.addDays(t, 1), status: 'pendente', start: k.fixed ? k.start : null }); else if (a === 'sp') A.splitTask(k); else if (a === 'nw') S.update(k.id, { date: S.addDays(t, 7 - ((S.parseYmd(t).getDay() + 6) % 7)), status: 'pendente', start: null }); };
    if (wkStep === 0) {
      const left = S.state.tasks.filter(k => (k.status === 'pendente' || k.status === 'adiada') && k.date <= t && !k.fixed);
      body.innerHTML = `<div class="hint">O que ficou para trás nesta semana. Decida em um toque.</div>`;
      if (!left.length) body.innerHTML += '<div class="wk-ok">Nada ficou para trás. Boa semana.</div>';
      left.forEach(k => body.appendChild(row(k, [['Amanhã', 'tm'], ['Próx. semana', 'nw'], ['Remover', 'rm']])));
    } else if (wkStep === 1) {
      const rep = S.state.tasks.filter(k => k.status !== 'concluida' && (k.postponed || 0) >= 2);
      body.innerHTML = `<div class="hint">Tarefas adiadas duas vezes ou mais. Em geral estão grandes demais ou não importam tanto.</div>`;
      if (!rep.length) body.innerHTML += '<div class="wk-ok">Nenhuma tarefa em loop de adiamento.</div>';
      rep.forEach(k => body.appendChild(row(k, [['Dividir', 'sp'], ['Remover', 'rm']])));
    } else if (wkStep === 2) {
      const monday = S.addDays(t, 7 - ((S.parseYmd(t).getDay() + 6) % 7)); const cap = S.settings.capacity * 60;
      let html = '<div class="hint">Carga da próxima semana contra sua capacidade.</div><div class="wk-days">';
      for (let i = 0; i < 7; i++) { const d = S.addDays(monday, i); const m = S.tasks(d).reduce((a, k) => a + k.dur, 0); const en = S.energyDay(d); html += `<div class="${m > cap || en > S.settings.energy ? 'over' : ''}"><span>${A.DOWS[S.parseYmd(d).getDay()]}</span><b>${m ? fmtDur(m) : '—'}</b><small>⚡ ${String(en).replace('.', ',')}</small></div>`; }
      html += '</div><div class="hint">Dias em destaque passam da capacidade ou da energia. Use <b>Rotinas</b> para montar dias vazios ou <b>Monta meu dia</b> em cada um.</div>';
      body.innerHTML = html;
    } else {
      S.setSettings({ lastWeekly: t });
      const st = S.stats(); const wkDone = Object.keys(st.byDay).filter(d => d > S.addDays(t, -7) && d <= t).reduce((a, d) => a + st.byDay[d].done, 0);
      body.innerHTML = `<div class="wk-ok">Semana revisada. Você concluiu <b>${wkDone}</b> tarefas nos últimos 7 dias e está com <b>${st.streak}</b> dia${st.streak !== 1 ? 's' : ''} seguidos.</div><div class="hint">O Deki lembra você no próximo domingo.</div>`;
    }
    $('#wkNext').textContent = wkStep === 3 ? 'Concluir' : 'Próximo';
  }
  $('#wkNext').addEventListener('click', () => { if (wkStep === 3) { A.closeSheets(); A.render(); return; } wkStep++; renderWeekly(); });
  $('#mWeekly').addEventListener('click', () => { A.closeSheets(); openWeekly(); });
  function weeklyNudge() {
    const d = new Date(); const t = S.today();
    const due = !S.settings.lastWeekly || S.settings.lastWeekly < S.addDays(t, -6);
    if (due && d.getDay() === 0 && d.getHours() >= 18 && localStorage.getItem('deki.nudge') !== t) { localStorage.setItem('deki.nudge', t); toast('Domingo à noite: a revisão semanal leva 5 minutos. Está no menu ≡', 5000); }
  }

  /* =========================================================
     8 · Captura por voz
     ========================================================= */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('#capMic');
  if (!SR) mic.hidden = true;
  else {
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = false;
      mic.classList.add('on'); $('#capInput').placeholder = 'Pode falar…';
      rec.onresult = e => { let s = ''; for (const r of e.results) s += r[0].transcript; $('#capInput').value = s.replace(/\s+/g, ' ').trim(); A.renderChips(); };
      rec.onerror = e => { toast(e.error === 'not-allowed' ? 'Permita o microfone para falar' : 'Não entendi, tente de novo'); };
      rec.onend = () => { rec = null; mic.classList.remove('on'); $('#capInput').placeholder = 'ex.: "sex 15h dentista, lembrar 1h antes, 40min"'; A.renderChips(); };
      try { rec.start(); } catch (e) { rec = null; mic.classList.remove('on'); }
    });
  }

  /* =========================================================
     9 · Importar agenda (.ics) do Outlook ou Google
     ========================================================= */
  function parseIcs(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n'); const out = []; let cur = null; const unf = [];
    lines.forEach(l => { if (/^[ \t]/.test(l) && unf.length) unf[unf.length - 1] += l.slice(1); else unf.push(l); });
    const toDate = (v, params) => {
      if (/VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(v)) return { d: new Date(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)), allDay: true };
      const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/); if (!m) return null;
      if (m[7] === 'Z') return { d: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))), allDay: false };
      return { d: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)), allDay: false };
    };
    unf.forEach(l => {
      if (l === 'BEGIN:VEVENT') cur = {};
      else if (l === 'END:VEVENT') { if (cur && cur.start) out.push(cur); cur = null; }
      else if (cur) {
        const i = l.indexOf(':'); if (i < 0) return; const key = l.slice(0, i); const val = l.slice(i + 1); const name = key.split(';')[0];
        if (name === 'SUMMARY') cur.summary = val.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
        else if (name === 'UID') cur.uid = val;
        else if (name === 'DTSTART') cur.start = toDate(val, key);
        else if (name === 'DTEND') cur.end = toDate(val, key);
        else if (name === 'RRULE') cur.rrule = val;
        else if (name === 'LOCATION') cur.location = val.replace(/\\,/g, ',').trim();
        else if (name === 'DESCRIPTION') cur.desc = val.replace(/\\n/g, ' ').replace(/\\,/g, ',').slice(0, 200);
      }
    });
    return out;
  }
  function importIcs(text) {
    const evs = parseIcs(text); const t = S.today(); const until = S.addDays(t, 60);
    let added = 0, skipped = 0, allDay = 0;
    evs.forEach(ev => {
      if (!ev.start) return; if (ev.start.allDay) { allDay++; return; }
      const dur = ev.end ? Math.max(15, Math.round((ev.end.d - ev.start.d) / 60000)) : 60;
      const occ = [];
      if (ev.rrule) {
        const freq = (ev.rrule.match(/FREQ=(\w+)/) || [])[1]; const count = +(ev.rrule.match(/COUNT=(\d+)/) || [])[1] || 400; const untilM = (ev.rrule.match(/UNTIL=(\d{8})/) || [])[1];
        const untilS = untilM ? `${untilM.slice(0, 4)}-${untilM.slice(4, 6)}-${untilM.slice(6, 8)}` : until;
        const byday = ((ev.rrule.match(/BYDAY=([^;]+)/) || [])[1] || '').split(',').filter(Boolean);
        const map = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
        const step = freq === 'DAILY' ? 1 : freq === 'WEEKLY' ? 7 : 0;
        if (step) {
          let d = new Date(ev.start.d); let n = 0;
          const lim = untilS < until ? untilS : until;
          while (n < count && S.ymd(d) <= lim) {
            if (freq === 'WEEKLY' && byday.length) { for (let i = 0; i < 7; i++) { const dd = new Date(d); dd.setDate(d.getDate() - ((d.getDay() + 7) % 7) + i); if (byday.includes(Object.keys(map).find(k => map[k] === dd.getDay())) && dd >= ev.start.d) occ.push(dd); } }
            else occ.push(new Date(d));
            d.setDate(d.getDate() + step); n++;
          }
        } else occ.push(ev.start.d);
      } else occ.push(ev.start.d);
      occ.forEach(d => {
        const date = S.ymd(d); if (date < t || date > until) return;
        const sid = `${ev.uid || ev.summary}@${date}`;
        if (S.state.tasks.some(k => k.sourceId === sid)) { skipped++; return; }
        S.add({ title: ev.summary || 'Compromisso', note: ev.location || '', date, start: S.hm(d.getHours() * 60 + d.getMinutes()), dur, fixed: true, effort: 'normal', remind: 10, sourceId: sid, prep: ev.desc ? { note: ev.desc, link: (ev.desc.match(/https?:\/\/\S+/) || [''])[0], checklist: '', checked: [] } : null });
        added++;
      });
    });
    A.closeSheets(); A.render();
    toast(`${added} compromisso${added !== 1 ? 's' : ''} importado${added !== 1 ? 's' : ''}${skipped ? `, ${skipped} já existia${skipped > 1 ? 'm' : ''}` : ''}${allDay ? `, ${allDay} de dia inteiro ignorado${allDay > 1 ? 's' : ''}` : ''}`, 4500);
  }
  $('#mIcs').addEventListener('click', () => { A.closeSheets(); $('#icsUrl').value = S.settings.icsUrl || ''; $('#sheetIcs').hidden = false; });
  $('#icsFileBtn').addEventListener('click', () => $('#icsFile').click());
  $('#icsFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) f.text().then(importIcs).catch(() => toast('Não consegui ler o arquivo')); e.target.value = ''; });
  $('#icsUrlBtn').addEventListener('click', async () => {
    const url = $('#icsUrl').value.trim(); if (!url) return toast('Cole o link da agenda');
    S.setSettings({ icsUrl: url }); toast('Buscando a agenda…');
    const local = /^(localhost|127\.|192\.168\.|10\.|172\.)/.test(location.hostname);
    try {
      const r = await fetch(local ? '/ics?url=' + encodeURIComponent(url) : url.replace(/^webcal:\/\//i, 'https://'));
      if (!r.ok) throw new Error(await r.text()); importIcs(await r.text());
    } catch (e) { toast(local ? 'Não consegui buscar: ' + (e.message || 'verifique o link') : 'Pelo link só funciona rodando no PC (node server.js). Aqui, baixe o .ics da agenda e use "Escolher arquivo".', 5000); }
  });

  /* =========================================================
     10 · Arquivo sincronizado (OneDrive) via File System Access
     ========================================================= */
  const FS = {
    db() { return new Promise((res, rej) => { const r = indexedDB.open('deki-fs', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async get() { try { const db = await this.db(); return await new Promise((res, rej) => { const t = db.transaction('h').objectStore('h').get('file'); t.onsuccess = () => res(t.result || null); t.onerror = () => rej(t.error); }); } catch (e) { return null; } },
    async set(h) { const db = await this.db(); return new Promise((res, rej) => { const t = db.transaction('h', 'readwrite').objectStore('h').put(h, 'file'); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); },
    async clear() { const db = await this.db(); return new Promise((res) => { const t = db.transaction('h', 'readwrite').objectStore('h').delete('file'); t.onsuccess = () => res(); t.onerror = () => res(); }); }
  };
  let handle = null, writeT = null;
  async function writeFile() {
    if (!handle) return;
    try { const w = await handle.createWritable(); await w.write(S.exportJson()); await w.close(); setSyncHint(`Sincronizado com ${handle.name} · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`); }
    catch (e) { setSyncHint('Não consegui gravar no arquivo. Toque em "Vincular arquivo" para reconectar.'); }
  }
  function setSyncHint(msg) { const h = $('#syncHint'); if (h) h.innerHTML = esc(msg); }
  S.onChange(() => { if (!handle) return; clearTimeout(writeT); writeT = setTimeout(writeFile, 1500); });
  async function linkFile() {
    if (!window.showSaveFilePicker) return toast('Neste navegador use Exportar/Importar. O arquivo vinculado funciona no Chrome ou Edge do PC.', 4500);
    try {
      let h = await FS.get();
      if (h) { const p = await h.requestPermission({ mode: 'readwrite' }); if (p !== 'granted') h = null; }
      if (!h) { h = await window.showSaveFilePicker({ suggestedName: 'deki.json', types: [{ description: 'Dados do Deki', accept: { 'application/json': ['.json'] } }] }); await FS.set(h); }
      handle = h; S.setSettings({ syncName: h.name });
      // se o arquivo já tem dados mais novos, puxa; senão, grava
      try { const f = await h.getFile(); const txt = await f.text(); if (txt && S.importJson(txt, { onlyIfNewer: true })) { toast('Dados mais novos carregados do arquivo'); A.render(); } } catch (e) {}
      await writeFile(); toast(`Arquivo vinculado: ${h.name}`); A.closeSheets();
    } catch (e) { if (e && e.name !== 'AbortError') toast('Não foi possível vincular o arquivo'); }
  }
  async function bootSync() {
    if (!window.showSaveFilePicker) return;
    const h = await FS.get(); if (!h) return;
    try {
      const p = await h.queryPermission({ mode: 'readwrite' });
      if (p === 'granted') { handle = h; const f = await h.getFile(); const txt = await f.text(); if (txt && S.importJson(txt, { onlyIfNewer: true })) { toast('Dados atualizados do arquivo ' + h.name); A.render(); } setSyncHint(`Sincronizando com ${h.name}`); }
      else setSyncHint(`Arquivo ${h.name} vinculado. Toque em "Vincular arquivo no OneDrive" para reconectar nesta sessão.`);
    } catch (e) {}
  }
  $('#mSync').addEventListener('click', linkFile);

  /* =========================================================
     11 · Projetos com prazo
     ========================================================= */
  function renderProjects() {
    const box = $('#projects'); if (!box) return; box.innerHTML = '';
    const t = S.today();
    if (!S.state.projects.length) { box.innerHTML = '<div class="hint" style="padding:0 18px">Dê o nome, o prazo e as etapas. O Deki espalha os blocos pelos dias até o prazo.</div>'; return; }
    S.state.projects.forEach(p => {
      const pr = S.projectProgress(p);
      const remaining = p.steps.filter(s => { const k = S.get(s.taskId); return !k || k.status !== 'concluida'; }).reduce((a, s) => a + s.dur, 0);
      let free = 0; for (let d = t; d <= p.deadline; d = S.addDays(d, 1)) free += S.freeMin(d);
      const days = Math.round((S.parseYmd(p.deadline) - S.parseYmd(t)) / 86400000);
      const missing = p.steps.filter(s => !S.get(s.taskId) && !s.done);
      const bad = days < 0 ? 'prazo passou' : missing.length ? `${missing.length} etapa${missing.length > 1 ? 's' : ''} sem dia` : remaining > free + S.tasks(t).filter(k => k.projectId === p.id && k.status !== 'concluida').reduce((a, k) => a + k.dur, 0) ? `não fecha: faltam ${fmtDur(remaining - free)}` : '';
      const el = document.createElement('div'); el.className = 'pj' + (bad ? ' bad' : '');
      el.innerHTML = `<div class="pj-h"><b>${esc(p.name)}</b><small>${days < 0 ? 'venceu' : days === 0 ? 'hoje' : `${days} dia${days > 1 ? 's' : ''}`} · ${shortDate(p.deadline)}</small></div><div class="pj-bar"><i style="width:${pr.pct}%"></i></div><div class="pj-f"><span>${pr.done} de ${pr.total} etapas · ${fmtDur(remaining)} restantes</span><span class="pj-s">${bad || 'no ritmo'}</span></div><div class="pj-b"><button data-re="${p.id}">Redistribuir</button><button data-rm="${p.id}">Remover</button></div>`;
      el.querySelector('[data-re]').addEventListener('click', () => { p.steps.forEach(s => { const k = S.get(s.taskId); if (k && k.status !== 'concluida') { S.remove(k.id); s.taskId = null; } }); const nf = S.distributeProject(p); toast(nf.length ? `${nf.length} etapa${nf.length > 1 ? 's' : ''} não coube${nf.length > 1 ? 'ram' : ''} até o prazo` : 'Redistribuído'); A.render(); });
      el.querySelector('[data-rm]').addEventListener('click', () => { if (!confirm(`Remover "${p.name}" e suas etapas pendentes?`)) return; p.steps.forEach(s => { const k = S.get(s.taskId); if (k && k.status !== 'concluida') S.remove(k.id); }); S.state.projects = S.state.projects.filter(x => x.id !== p.id); S.save(); A.render(); });
      box.appendChild(el);
    });
  }
  $('#btnNewProject').addEventListener('click', () => { $('#prName').value = ''; $('#prDeadline').value = S.addDays(S.today(), 14); $('#prSteps').value = ''; $('#sheetProject').hidden = false; });
  $('#prSave').addEventListener('click', () => {
    const name = $('#prName').value.trim(); const deadline = $('#prDeadline').value; const effort = $('#prEffort').value;
    const steps = $('#prSteps').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)[\s,|-]*(\d{1,3})\s*(?:min|m)?$/); return m ? { title: m[1].trim() || 'Etapa', dur: Math.max(5, +m[2]) } : { title: l, dur: 60 }; });
    if (!name || !deadline || !steps.length) return toast('Preencha nome, prazo e pelo menos uma etapa');
    if (deadline < S.today()) return toast('O prazo já passou');
    const p = { id: S.uid(), name, deadline, steps: steps.map(s => Object.assign(s, { effort })), createdAt: Date.now() };
    S.state.projects.push(p); const nf = S.distributeProject(p);
    A.closeSheets(); A.view = 'week'; A.render();
    toast(nf.length ? `Distribuído, mas ${nf.length} etapa${nf.length > 1 ? 's' : ''} não coube${nf.length > 1 ? 'ram' : ''} até o prazo. Aumente a capacidade ou o prazo.` : `"${name}" distribuído até ${shortDate(deadline)}`, 4500);
  });
  A.onRender(() => { if (A.view === 'week') renderProjects(); });

  /* =========================================================
     12 · Monta meu dia (assistente de planejamento)
     ========================================================= */
  let asPlan = null;
  function openAssist(date) {
    date = date || A.sel; const budget = S.settings.energy; const r = S.settings.ritmo;
    const all = S.tasks(date); const fixed = all.filter(k => k.fixed || k.status === 'concluida' || k.status === 'andamento');
    const flex = all.filter(k => !fixed.includes(k));
    const score = k => (k.status === 'adiada' ? -100 : 0) + (k.projectId ? -20 : 0) + (k.effort === r ? -10 : 0) + (r === 'leve' && k.effort === 'intenso' ? 50 : 0);
    flex.sort((a, b) => score(a) - score(b) || a.createdAt - b.createdAt);
    let energy = fixed.reduce((a, k) => a + S.energyOf(k), 0); let minutes = fixed.reduce((a, k) => a + k.dur, 0);
    const cap = S.settings.capacity * 60; const keep = [], move = [];
    flex.forEach(k => { const e = S.energyOf(k); if (energy + e <= budget && minutes + k.dur <= cap) { keep.push(k); energy += e; minutes += k.dur; } else move.push(k); });
    asPlan = { date, keep, move };
    const body = $('#asBody');
    if (!all.length) {
      body.innerHTML = `<div class="hint">O dia está vazio. Comece por uma rotina:</div><div class="as-tpl">${S.state.templates.map(t => `<button class="btn" data-t="${t.id}">${esc(t.name)}</button>`).join('')}</div>`;
      body.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => applyTemplate(b.dataset.t, date)));
      $('#asApply').hidden = true;
    } else {
      $('#asApply').hidden = false;
      const order = S.plan(date);
      const line = k => `<div class="as-row"><span class="as-t">${k.start || '—'}</span><span>${esc(k.title)}</span><small>${fmtDur(k.dur)} · ⚡${String(S.energyOf(k)).replace('.', ',')}</small></div>`;
      body.innerHTML = `<div class="hint">Ritmo <b>${r}</b> · energia ${String(Math.round(energy * 10) / 10).replace('.', ',')} de ${budget} · ${fmtDur(minutes)} de ${fmtDur(cap)}</div>
        <div class="sec">Fica para ${shortDate(date)}</div>${order.filter(k => keep.some(x => x.id === k.id) || fixed.some(x => x.id === k.id)).map(line).join('') || '<div class="hint">nada</div>'}
        ${move.length ? `<div class="sec">Vai para ${shortDate(S.addDays(date, 1))}</div>${move.map(line).join('')}` : '<div class="wk-ok">Tudo cabe no dia. Só aceitar.</div>'}`;
    }
    $('#sheetAssist').hidden = false;
  }
  $('#asApply').addEventListener('click', () => {
    if (!asPlan) return;
    asPlan.move.forEach(k => S.update(k.id, { date: S.addDays(asPlan.date, 1), start: null }));
    asPlan.keep.forEach(k => { if (!k.fixed) S.update(k.id, { start: null }); });
    A.closeSheets(); A.sel = asPlan.date; A.view = 'day'; A.render();
    toast(asPlan.move.length ? `Dia montado · ${asPlan.move.length} para ${shortDate(S.addDays(asPlan.date, 1))}` : 'Dia montado');
  });
  $('#mAssist').addEventListener('click', () => { A.closeSheets(); openAssist(A.sel); });
  $('#emptyAssist').addEventListener('click', () => openAssist(A.sel));
  A.openAssist = openAssist;
  A.onActions((ctx, btns) => {
    if (ctx.view === 'day' && !ctx.running && ctx.plan && !ctx.plan.length) return { btns: [['p', 'Monta meu dia', () => openAssist(ctx.sel)], ['', 'Nova', () => A.openCapture(ctx.sel)], ['', 'Rotinas', openTemplates]] };
  });

  /* =========================================================
     13 · Modo compacto (atalho "Próxima tarefa")
     ========================================================= */
  function renderMini() {
    const t = S.today(); const running = S.state.tasks.find(k => k.status === 'andamento');
    const plan = S.plan(t); const next = running || plan.find(k => (k.status === 'pendente' || k.status === 'adiada') && (!k.fixed || S.toMin(k.start) + k.dur > A.nowMin()));
    const box = $('#mBtns'); box.innerHTML = '';
    if (!next) { $('#mLbl').textContent = 'Hoje'; $('#mTitle').textContent = plan.length ? 'Tudo concluído' : 'Dia livre'; $('#mSub').textContent = ''; const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = 'Nova tarefa'; b.addEventListener('click', () => { document.body.classList.remove('mini-mode'); $('#mini').hidden = true; A.openCapture(t); }); box.appendChild(b); return; }
    $('#mLbl').textContent = running ? (running.pausedAt ? 'Pausada' : 'Em andamento') : 'Próxima';
    $('#mTitle').textContent = next.title;
    $('#mSub').textContent = running ? `${A.progressOf(running)}% · ${fmtDur(running.dur)}` : `${next.start} · ${fmtDur(next.dur)}${next.note ? ' · ' + next.note : ''}`;
    const mk = (cls, label, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.addEventListener('click', fn); box.appendChild(b); };
    if (running) { mk('primary', 'Concluir', () => { A.completeTask(running, null, { instant: true }); renderMini(); }); mk('', 'Foco', () => { document.body.classList.remove('mini-mode'); $('#mini').hidden = true; openFocus(running.id); }); }
    else { mk('primary', 'Iniciar', () => { A.startTask(next, { noFocus: true, quiet: true }); renderMini(); }); mk('', 'Adiar', () => { A.postponeTask(next); renderMini(); }); }
  }

  /* =========================================================
     início
     ========================================================= */
  A.boot();
  if (q.get('mini')) { document.body.classList.add('mini-mode'); $('#mini').hidden = false; renderMini(); setInterval(renderMini, 30000); }
  if (q.get('nova')) A.openCapture(S.today());
  if (q.get('monta')) openAssist(S.today());
  bootSync(); weeklyNudge();
  A.onRender(kind => { if (kind === 'tick') weeklyNudge(); });
})();

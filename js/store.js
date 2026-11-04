/* Deki · dados locais (localStorage) */
(function (global) {
  const KEY = 'deki.v1';

  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const today = () => ymd(new Date());
  const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s*\(\d+\/\d+\)\s*$/, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const ENERGY = { leve: 0.6, normal: 1, intenso: 1.7 };

  const defaultTemplates = () => ([
    { id: 'obra', name: 'Dia de obra', items: [
      { title: 'Conferir diário de obra de ontem', dur: 20, effort: 'leve', start: '07:30', fixed: false },
      { title: 'Visita de campo', dur: 180, effort: 'intenso', start: '08:00', fixed: true },
      { title: 'Preencher diário de obra', dur: 40, effort: 'normal', start: null, fixed: false },
      { title: 'Comentários da supervisora', dur: 30, effort: 'normal', start: null, fixed: false },
      { title: 'Responder e-mails', dur: 20, effort: 'leve', start: null, fixed: false } ] },
    { id: 'estudo', name: 'Dia de estudo', items: [
      { title: 'Revisar anotações', dur: 30, effort: 'leve', start: null, fixed: false },
      { title: 'Bloco de estudo 1', dur: 90, effort: 'intenso', start: null, fixed: false },
      { title: 'Pausa ativa', dur: 15, effort: 'leve', start: null, fixed: false },
      { title: 'Bloco de estudo 2', dur: 90, effort: 'intenso', start: null, fixed: false },
      { title: 'Exercícios', dur: 60, effort: 'normal', start: null, fixed: false } ] },
    { id: 'entrega', name: 'Dia de entrega', items: [
      { title: 'Revisão final do texto', dur: 60, effort: 'intenso', start: null, fixed: false },
      { title: 'Conferir figuras e tabelas', dur: 40, effort: 'normal', start: null, fixed: false },
      { title: 'Formatar e gerar PDF', dur: 30, effort: 'normal', start: null, fixed: false },
      { title: 'Enviar e confirmar recebimento', dur: 15, effort: 'leve', start: null, fixed: false } ] }
  ]);

  const defaults = () => ({
    settings: { ritmo: 'normal', dayStart: '07:00', dayEnd: '22:00', capacity: 8, energy: 12, samples: true, lastWeekly: null, syncName: null },
    tasks: [],
    estimates: {},   // chave do título -> [minutos reais]
    journal: [],     // fechamento conversado
    projects: [],    // projetos com prazo
    templates: defaultTemplates(),
    lastOpen: today(),
    savedAt: 0
  });

  let state = load();
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return merge(JSON.parse(raw));
    } catch (e) { console.warn('Deki: não foi possível ler os dados', e); }
    const s = defaults();
    s.tasks = sampleTasks();
    return s;
  }
  function merge(s) {
    const d = defaults();
    const out = Object.assign(d, s, { settings: Object.assign(d.settings, s.settings || {}) });
    if (!Array.isArray(out.templates) || !out.templates.length) out.templates = defaultTemplates();
    out.estimates = out.estimates || {}; out.journal = out.journal || []; out.projects = out.projects || [];
    return out;
  }
  function save() {
    state.savedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Deki: não foi possível salvar', e); }
    listeners.forEach(fn => { try { fn(); } catch (e) {} });
  }

  function sampleTasks() {
    const t = today();
    const mk = (o) => Object.assign(blank(), { date: t, sample: true }, o);
    return [
      mk({ title: 'Planejar o dia', dur: 5, effort: 'leve', status: 'concluida', progress: 100, start: '08:30', doneAt: Date.now(), actual: 4 }),
      mk({ title: 'Reunião de alinhamento', note: 'sala 2', start: '09:00', dur: 60, fixed: true, remind: 10, prep: { note: 'Levar o cronograma atualizado', link: '', checklist: 'Pedir prazo do lote 2\nConfirmar data da vistoria' } }),
      mk({ title: 'Relatório de acidentes', note: 'Projeto Integrado', start: '10:30', dur: 90, effort: 'intenso' }),
      mk({ title: 'Cálculo de sinalização', note: 'Projeto Integrado', dur: 90, effort: 'intenso' }),
      mk({ title: 'Responder e-mails do orientador', dur: 20, effort: 'leve' }),
      mk({ title: 'Academia', start: '16:30', dur: 60, fixed: true, effort: 'leve' }),
      mk({ title: 'Revisar planilha diário de obra', dur: 45, status: 'adiada', postponed: 1 }),
      mk({ title: 'Dentista', start: '15:00', dur: 40, fixed: true, remind: 60, date: addDays(t, 2) }),
      mk({ title: 'Revisão final do Projeto Integrado', dur: 120, effort: 'intenso', date: addDays(t, 3) })
    ];
  }
  function blank() {
    return { id: uid(), title: 'Sem título', note: '', date: today(), start: null, dur: 30, fixed: false, effort: 'normal', status: 'pendente', progress: 0, postponed: 0, remind: null, startedAt: null, doneAt: null, pausedMs: 0, pausedAt: null, actual: null, prep: null, projectId: null, sourceId: null, createdAt: Date.now() };
  }

  /* Tarefas de dias passados que não foram concluídas escorregam para hoje */
  function slip() {
    const t = today();
    let n = 0;
    state.tasks.forEach(k => {
      if (k.status !== 'concluida' && k.date < t) {
        k.date = t; k.postponed = (k.postponed || 0) + 1; k.status = 'adiada';
        if (k.fixed) { k.fixed = false; k.start = null; }
        n++;
      }
    });
    state.lastOpen = t;
    if (n) save();
    return n;
  }

  const api = {
    get state() { return state; },
    get settings() { return state.settings; },
    save, slip, today, ymd, parseYmd, addDays, hm, toMin, pad, uid, norm, blank,
    onChange(fn) { listeners.push(fn); },
    tasks(date) { return state.tasks.filter(k => k.date === date); },
    get(id) { return state.tasks.find(k => k.id === id); },
    add(t) { const task = Object.assign(blank(), t); state.tasks.push(task); save(); return task; },
    update(id, patch) { const k = api.get(id); if (!k) return null; Object.assign(k, patch); save(); return k; },
    remove(id) { state.tasks = state.tasks.filter(k => k.id !== id); save(); },
    removeSamples() { state.tasks = state.tasks.filter(k => !k.sample); state.settings.samples = false; save(); },
    setSettings(p) { Object.assign(state.settings, p); save(); },
    exportJson() { return JSON.stringify(state, null, 2); },
    importJson(text, opts) {
      const s = JSON.parse(text);
      if (!s || !Array.isArray(s.tasks)) throw new Error('Arquivo inválido');
      if (opts && opts.onlyIfNewer && !(s.savedAt > state.savedAt)) return false;
      state = merge(s); save(); return true;
    },

    /* energia */
    energyOf(k) { return Math.round((k.dur / 30) * (ENERGY[k.effort] || 1) * 10) / 10; },
    energyDay(date) { return Math.round(api.tasks(date).reduce((a, k) => a + api.energyOf(k), 0) * 10) / 10; },

    /* estimativas que aprendem */
    recordActual(k, minutes) {
      const key = norm(k.title); if (!key) return;
      const arr = state.estimates[key] = (state.estimates[key] || []).slice(-8);
      arr.push(Math.max(1, Math.round(minutes)));
      k.actual = Math.round(minutes); save();
    },
    suggestDur(title) {
      const arr = state.estimates[norm(title)]; if (!arr || !arr.length) return null;
      const s = arr.slice().sort((a, b) => a - b); const med = s[Math.floor(s.length / 2)];
      return { median: Math.round(med / 5) * 5 || 5, n: arr.length };
    },

    /* encaixe automático */
    plan(date, opts) {
      const s = state.settings; opts = opts || {};
      const isToday = date === today();
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const dayStart = toMin(s.dayStart), dayEnd = toMin(s.dayEnd);
      const list = api.tasks(date).map(k => Object.assign({}, k));
      const fixedLike = list.filter(k => k.start && (k.fixed || k.status === 'concluida' || k.status === 'andamento'));
      const flex = list.filter(k => !fixedLike.includes(k));
      const r = s.ritmo;
      const score = k => (k.status === 'adiada' ? -100 : 0) + (k.effort === r ? -10 : 0) + (r === 'leve' && k.effort === 'intenso' ? 50 : 0) + (r === 'intenso' && k.effort === 'leve' ? 5 : 0);
      flex.sort((a, b) => score(a) - score(b) || a.createdAt - b.createdAt);
      const busy = fixedLike.map(k => [toMin(k.start), toMin(k.start) + k.dur]).sort((a, b) => a[0] - b[0]);
      let cursor = Math.max(dayStart, isToday ? Math.ceil(nowMin / 5) * 5 : dayStart);
      if (opts.from != null) cursor = Math.max(cursor, opts.from);
      const placed = [];
      flex.forEach(k => {
        if (k.start && !k.fixed && k.status === 'pendente' && toMin(k.start) >= cursor && !opts.ignoreSuggested) {
          placed.push(k); busy.push([toMin(k.start), toMin(k.start) + k.dur]); busy.sort((a, b) => a[0] - b[0]); return;
        }
        let t = cursor;
        for (;;) { const c = busy.find(([a, b]) => t < b && t + k.dur > a); if (!c) break; t = c[1]; }
        k.start = hm(Math.min(t, 23 * 60 + 55)); k.auto = true;
        if (t + k.dur > dayEnd) k.overflow = true;
        busy.push([t, t + k.dur]); busy.sort((a, b) => a[0] - b[0]);
        cursor = t + k.dur; placed.push(k);
      });
      const all = fixedLike.concat(placed);
      all.sort((a, b) => toMin(a.start) - toMin(b.start));
      return all;
    },

    /* replanejar: solta horários sugeridos, reencaixa a partir de agora, empurra o que não cabe */
    replan(date) {
      const pend = api.tasks(date).filter(k => !k.fixed && k.status !== 'concluida' && k.status !== 'andamento');
      pend.forEach(k => { k.start = null; });
      const planned = api.plan(date, { ignoreSuggested: true });
      const moved = [];
      planned.forEach(p => {
        if (p.overflow) { const k = api.get(p.id); if (k && !k.fixed) { k.date = addDays(date, 1); k.status = 'adiada'; k.postponed = (k.postponed || 0) + 1; moved.push(k); } }
      });
      save();
      return { kept: planned.length - moved.length, moved };
    },

    /* capacidade livre do dia em minutos */
    freeMin(date) { return Math.max(0, state.settings.capacity * 60 - api.tasks(date).reduce((a, k) => a + k.dur, 0)); },

    /* projetos com prazo: distribui etapas até o prazo respeitando a capacidade livre */
    distributeProject(p) {
      const t = today(); const notFit = [];
      let day = t;
      p.steps.forEach(st => {
        if (st.taskId && api.get(st.taskId)) return;
        let placed = false; let d = day;
        while (d <= p.deadline) {
          if (api.freeMin(d) >= st.dur) {
            const k = api.add({ title: st.title, note: p.name, date: d, dur: st.dur, effort: st.effort || (st.dur >= 90 ? 'intenso' : 'normal'), projectId: p.id });
            st.taskId = k.id; placed = true; day = d; break;
          }
          d = addDays(d, 1);
        }
        if (!placed) notFit.push(st);
      });
      save();
      return notFit;
    },
    projectProgress(p) {
      const ts = p.steps.map(s => api.get(s.taskId)).filter(Boolean);
      const done = ts.filter(k => k.status === 'concluida').length;
      return { total: p.steps.length, done, pct: p.steps.length ? Math.round(done / p.steps.length * 100) : 0 };
    },

    stats() {
      const t = today();
      const byDay = {};
      state.tasks.forEach(k => { byDay[k.date] = byDay[k.date] || { total: 0, done: 0, focus: 0 }; byDay[k.date].total++; if (k.status === 'concluida') { byDay[k.date].done++; byDay[k.date].focus += k.actual || k.dur; } });
      let streak = 0; let d = t;
      if (!(byDay[d] && byDay[d].done)) d = addDays(d, -1);
      while (byDay[d] && byDay[d].done) { streak++; d = addDays(d, -1); }
      return { byDay, streak };
    }
  };
  global.Store = api;
})(window);

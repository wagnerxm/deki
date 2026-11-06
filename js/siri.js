/* Deki · "Fala Deki": a Siri deixa a frase como issue no repositório privado (caixa de entrada)
   e o Deki busca, transforma em tarefa e fecha a issue. A chave fica só neste aparelho. */
(function () {
  const S = Store, A = App, $ = A.$;
  const { shortDate, esc, toast } = A;
  const KEY = 'deki.siri';
  const API = 'https://api.github.com/repos/';
  const DEF_REPO = 'wagnerxm/deki-caixa';

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const store = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };
  let cfg = load();
  if (!cfg.repo) cfg.repo = DEF_REPO;
  if (!cfg.done) cfg.done = [];

  const headers = () => ({ Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
  const ready = () => !!(cfg.token && cfg.repo);

  /* ---------- buscar a caixa de entrada ---------- */
  let busy = false;
  async function poll(manual) {
    if (!ready() || busy || !navigator.onLine) return;
    busy = true;
    try {
      const r = await fetch(`${API}${cfg.repo}/issues?state=open&per_page=50&sort=created&direction=asc`, { headers: headers(), cache: 'no-store' });
      if (!r.ok) { cfg.err = r.status; store(cfg); if (manual) toast(r.status === 401 ? 'Chave inválida ou vencida' : r.status === 404 ? 'Repositório não encontrado (ou a chave não tem acesso)' : 'Erro ' + r.status + ' no GitHub'); return; }
      cfg.err = null;
      const list = (await r.json()).filter(i => !i.pull_request && !cfg.done.includes(i.number));
      const added = [];
      for (const i of list) {
        const text = (i.title || '').trim() || (i.body || '').trim();
        if (text) added.push(addFromText(text, S.ymd(new Date(i.created_at))));
        cfg.done.push(i.number); cfg.done = cfg.done.slice(-300); store(cfg);
        fetch(`${API}${cfg.repo}/issues/${i.number}`, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json' }, headers()), body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) }).catch(() => {});
      }
      cfg.last = Date.now(); store(cfg);
      if (added.length) { A.render(); announce(added.filter(Boolean)); }
      else if (manual) toast('Nada novo da Siri');
      if (!$('#sheetSiri').hidden) renderSheet();
    } catch (e) { if (manual) toast('Sem conexão com o GitHub'); }
    finally { busy = false; }
  }

  function addFromText(text, ref) {
    const p = Parse.parse(text, ref);
    const mk = date => S.add({ title: p.title, note: p.note, date, start: p.start, dur: p.dur, fixed: p.fixed, effort: p.effort, remind: p.remind, via: 'siri' });
    const first = mk(p.date); const ids = [first.id];
    if (p.repeat) { const step = p.repeat.kind === 'daily' ? 1 : 7; const times = p.repeat.kind === 'daily' ? 13 : 7; for (let n = 1; n <= times; n++) ids.push(mk(S.addDays(p.date, n * step)).id); }
    return { ids, title: p.title, date: p.date, start: p.start, text };
  }

  /* ---------- aviso com "Desfazer" ---------- */
  let annT;
  function announce(items) {
    if (!items.length) return;
    const el = $('#siriNote');
    const one = items[0];
    el.innerHTML = `<div class="sn-txt"><small>🎙 Da Siri</small><b>${items.length > 1 ? items.length + ' tarefas novas' : esc(one.title)}</b><span>${items.length > 1 ? items.map(k => esc(k.title)).join(' · ') : esc(shortDate(one.date) + (one.start ? ' · ' + one.start : ' · horário livre'))}</span></div><button class="sn-undo">Desfazer</button>`;
    el.hidden = false;
    el.querySelector('.sn-undo').addEventListener('click', () => { items.forEach(k => k.ids.forEach(id => S.remove(id))); el.hidden = true; A.render(); toast('Desfeito'); });
    if (items.length === 1 && one.date !== A.sel && A.view === 'day') { A.sel = one.date; A.render(); }
    clearTimeout(annT); annT = setTimeout(() => el.hidden = true, 9000);
  }

  /* ---------- tela de configurar ---------- */
  const URL_ISSUES = () => `${API}${cfg.repo}/issues`;
  function renderSheet() {
    $('#siRepo').value = cfg.repo || DEF_REPO;
    $('#siToken').value = '';
    $('#siToken').placeholder = cfg.token ? 'chave salva · cole outra para trocar' : 'cole aqui a chave do GitHub';
    const st = $('#siStatus');
    if (!cfg.token) { st.className = 'si-st'; st.textContent = 'Ainda não ligado.'; }
    else if (cfg.err) { st.className = 'si-st bad'; st.textContent = cfg.err === 401 ? 'A chave não funciona mais. Gere outra e cole aqui.' : 'Problema ao acessar a caixa (erro ' + cfg.err + ').'; }
    else { st.className = 'si-st ok'; st.textContent = 'Ligado. ' + (cfg.last ? 'Última busca ' + new Date(cfg.last).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.' : ''); }
    $('#siUrl').textContent = URL_ISSUES();
    $('#siOff').hidden = !cfg.token;
  }
  function openSheet() { A.closeSheets(); renderSheet(); $('#sheetSiri').hidden = false; }

  async function saveSheet() {
    const repo = $('#siRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '') || DEF_REPO;
    const tok = $('#siToken').value.trim();
    const next = Object.assign({}, cfg, { repo }); if (tok) next.token = tok;
    if (!next.token) { toast('Cole a chave do GitHub'); return; }
    try {
      const r = await fetch(`${API}${repo}/issues?state=open&per_page=1`, { headers: { Authorization: 'Bearer ' + next.token, Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      if (!r.ok) { toast(r.status === 401 ? 'Essa chave não foi aceita' : r.status === 404 ? 'A chave não enxerga esse repositório' : 'Erro ' + r.status); return; }
    } catch (e) { toast('Sem conexão para testar'); return; }
    cfg = next; cfg.err = null; store(cfg); renderSheet(); toast('Fala Deki ligado'); poll();
  }

  function copy(txt) { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Copiado'), () => toast(txt, 5000)); }

  $('#mSiri').addEventListener('click', openSheet);
  $('#siSave').addEventListener('click', saveSheet);
  $('#siNow').addEventListener('click', () => poll(true));
  $('#siOff').addEventListener('click', () => { delete cfg.token; cfg.err = null; store(cfg); renderSheet(); toast('Desligado neste aparelho'); });
  $('#siCopyUrl').addEventListener('click', () => copy(URL_ISSUES()));
  $('#siCopyAcc').addEventListener('click', () => copy('application/vnd.github+json'));

  /* ---------- quando buscar ---------- */
  poll();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  window.addEventListener('online', () => poll());
  setInterval(() => { if (!document.hidden) poll(); }, 30000);
  A.siri = { poll, addFromText };
})();

/* Deki · aba Hoje "em fitas": cada cartão vira uma fita na cor da fase que desce até a sua hora no trilho */
(function () {
  const S = Store, A = App, $ = A.$;
  const KEY = 'deki.fitas';
  const COR = { done: '--f-done', andamento: '--f-andamento', pausada: '--f-pausada', estourou: '--f-estourou', adiada: '--f-adiada', fixa: '--f-fixa', breve: '--f-breve', afazer: '--f-afazer' };
  const CLARO = { adiada: 1, estourou: 1 };
  const H = 64, GAP = 14, PAD = 18, RAIL = 50, TH = 14;
  const XS = [0.15, 0.05, 0.22, 0.09, 0.17, 0.28];

  let on = false; try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
  let animar = false, ultimo = [];

  const cor = ph => getComputedStyle(document.documentElement).getPropertyValue(COR[ph] || COR.afazer).trim() || '#F1E8DA';
  const mins = n => n >= 60 ? (n % 60 ? `${Math.floor(n / 60)}h${S.pad(n % 60)}` : `${n / 60}h`) : `${n} min`;

  function detalhe(k, ph) {
    const now = A.nowMin();
    if (ph === 'breve') return 'em ' + mins(Math.max(1, S.toMin(k.start) - now));
    if (ph === 'andamento') return 'faltam ' + mins(Math.max(1, Math.round(k.dur - A.elapsedMin(k))));
    if (ph === 'estourou') return 'passou ' + mins(Math.max(1, Math.round(A.elapsedMin(k) - k.dur)));
    if (ph === 'pausada') return 'pausada';
    if (ph === 'adiada') return 'adiada';
    if (k.isNext) return 'próxima';
    return '';
  }

  function render(plan) {
    ultimo = plan;
    const box = $('#fitas'), list = $('#list');
    $('#fitTg').classList.toggle('on', on);
    if (!on || !plan.length) { box.hidden = true; box.innerHTML = ''; if (plan.length) list.hidden = false; return; }
    list.hidden = true; box.hidden = false;
    const W = box.clientWidth || 360;
    const tail = Math.max(36, Math.round(W * 0.11)), X2 = W - tail, X1 = X2 - RAIL;
    const n = plan.length, alt = Math.max(380, PAD * 2 + n * (H + GAP) - GAP);
    box.style.height = alt + 'px';

    // faixa de horas do trilho: da primeira tarefa (ou agora) até o fim da última
    const hoje = A.sel === S.today(), agora = A.nowMin();
    let a = Math.min(...plan.map(k => S.toMin(k.start))), b = Math.max(...plan.map(k => S.toMin(k.start) + k.dur));
    if (hoje) { a = Math.min(a, agora); b = Math.max(b, agora); }
    a = Math.floor(a / 60) * 60; b = Math.ceil(b / 60) * 60; if (b - a < 240) b = a + 240;
    const hy = m => PAD + (m - a) / (b - a) * (alt - PAD * 2);

    const fitas = plan.map((k, i) => {
      const ph = A.phaseOf(k, A.sel);
      const destaque = k.isNext || ph === 'breve' || ph === 'andamento' || ph === 'estourou';
      const x0 = Math.round((destaque ? 0.02 : XS[i % XS.length]) * X1) + 10;
      const y = PAD + i * (H + GAP);
      const ty = Math.round(Math.min(alt - PAD - TH, Math.max(PAD, hy(S.toMin(k.start)) - TH / 2)));
      return { k, ph, x0, y, ty, c: cor(ph) };
    });

    // trilho com as horas
    const passo = (b - a) / 60 > 8 ? 2 : 1;
    let horas = '';
    for (let m = a; m <= b; m += 60 * passo) horas += `<span style="top:${Math.round(hy(m)) - 7}px">${m / 60}</span>`;

    // dobras e caudas
    let svg = `<svg width="${W}" height="${alt}" aria-hidden="true"><defs><linearGradient id="ftD" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient><linearGradient id="ftT" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>`;
    fitas.forEach(f => {
      const p = `M${X1},${f.y} L${X2},${f.ty} L${X2},${f.ty + TH} L${X1},${f.y + H} Z`;
      svg += `<path d="${p}" fill="${f.c}"/><path d="${p}" fill="url(#ftD)"/>`;
      svg += `<rect x="${X2}" y="${f.ty}" width="${tail}" height="${TH}" fill="${f.c}"/><rect x="${X2}" y="${f.ty}" width="${tail}" height="${TH}" fill="url(#ftT)"/>`;
      svg += `<line x1="${X2}" y1="${f.ty + .5}" x2="${W}" y2="${f.ty + .5}" stroke="#fff" stroke-opacity=".35"/><line x1="${X1}" y1="${f.y + 2}" x2="${X1}" y2="${f.y + H - 2}" stroke="#fff" stroke-opacity=".3" stroke-width="1.5"/>`;
    });
    svg += '</svg>';

    const pills = fitas.map((f, i) => {
      const d = detalhe(f.k, f.ph);
      return `<button class="fita${animar ? ' in' : ''}${CLARO[f.ph] ? ' claro' : ''}" data-id="${f.k.id}" style="left:${f.x0}px;top:${f.y}px;width:${X1 - f.x0 + 1}px;background:${f.c};animation-delay:${i * 45}ms">
        <span class="ft"><small>${f.k.start}${d ? ' · ' + d : ''}</small><b>${A.esc(f.k.title)}</b></span>${f.ph === 'done' ? '<span class="ok">✓</span>' : ''}</button>`;
    }).join('');

    let agoraHtml = '';
    if (hoje && agora >= a && agora <= b) {
      const ny = Math.round(hy(agora));
      agoraHtml = `<i class="ft-now" style="left:${X1}px;top:${ny}px"></i><span class="ft-nowt" style="top:${ny - 21}px">${S.hm(agora)}</span>`;
    }

    box.innerHTML = `<div class="ft-rail" style="left:${X1}px;width:${RAIL}px">${horas}</div>${svg}${pills}${agoraHtml}`;
    box.querySelectorAll('.fita').forEach(el => el.addEventListener('click', () => A.openTask(el.dataset.id)));
    animar = false;
  }

  A.onDay(render);
  $('#fitTg').addEventListener('click', () => {
    on = !on; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    animar = on; A.render(); A.toast(on ? 'Hoje em fitas' : 'Hoje em cartões', 1400);
  });
  // atualiza "em 20 min" e a linha de agora; redesenha ao girar a tela
  A.onRender(w => { if (w === 'tick' && on && A.view === 'day' && !document.hidden) render(ultimo); });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (on && A.view === 'day') render(ultimo); }, 150); });
})();

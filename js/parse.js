/* Deki · captura em português: "sex 15h dentista, lembrar 1h antes, 40min" */
(function (global) {
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const DOW = { domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6 };
  const MON = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
  const FIXED_WORDS = /dentista|medic[oa]|consulta|reuniao|aula|prova|entrevista|voo|viagem|audiencia|visita|exame|almoco com|jantar com/;

  function parse(text) {
    const S = global.Store;
    const todayS = S.today();
    const raw = text;
    // normalizado tem o mesmo comprimento do original (só remove acentos), então os índices batem
    let src = ' ' + norm(raw) + ' ';
    const mask = new Array(src.length).fill(false);
    const out = { title: '', date: todayS, start: null, dur: null, remind: null, fixed: null, effort: null, repeat: null, note: '' };

    const take = (re, fn) => {
      const m = src.match(re); if (!m) return false;
      const a = m.index, b = m.index + m[0].length;
      fn(m);
      for (let i = a; i < b; i++) mask[i] = true;
      src = src.slice(0, a) + ' '.repeat(b - a) + src.slice(b);
      return true;
    };

    let atWord = false;

    // comando falado no início: "Fala Deki, marca pra mim…", "me lembra de…", "anota…"
    take(/^\s(?:(?:e\s+ai\s+)?(?:fala\s+)?deki[\s,.!]+)?(?:por\s+favor[\s,]+)?(?:(?:marca|marque|marcar|agenda|agende|agendar|anota|anote|anotar|coloca|coloque|bota|adiciona|adicione|cria|crie)(?:\s+(?:pra|para)\s+mim)?|(?:me\s+)?(lembr[ae]|lembrar)(?:\s+(?:me|pra\s+mim|para\s+mim))?(?:\s+(?:de|da|do|que))?)(?:\s+(?:uma?|o|a)(?=\s))?[\s,:.]+/, m => { if (m[1]) out.remind = 0; });

    // horário falado: "às 14 horas", "às 14 e 30", "às 2 da tarde", "8 da manhã"
    take(/\s(?:as\s+|a\s+|das\s+)?(\d{1,2})(?:\s*(?:horas?|h))?(?:\s+e\s+(\d{1,2}|meia))?(?:\s*min(?:utos)?)?\s+da\s+(manha|tarde|noite|madrugada)\s*/, m => {
      let h = +m[1]; const mi = m[2] === 'meia' ? 30 : +(m[2] || 0);
      if ((m[3] === 'tarde' || m[3] === 'noite') && h < 12) h += 12;
      atWord = true; out.start = fix(h, mi);
    });
    for (let i = 0; i < 2; i++) {
      const ok = take(/\s(as|a\s+partir\s+das|das|ate\s+as)\s+(\d{1,2})\s*(?:horas?|h)?\s+e\s+(\d{1,2}|meia)(?:\s*min(?:utos)?)?\s*/, m => { atWord = atWord || /^a/.test(m[1]); setTime(+m[2], m[3] === 'meia' ? 30 : +m[3], m[1]); })
        || take(/\s(as|a\s+partir\s+das|das|ate\s+as)\s+(\d{1,2})\s*horas?\s*/, m => { atWord = atWord || /^a/.test(m[1]); setTime(+m[2], 0, m[1]); });
      if (!ok) break;
    }
    take(/\s(meio[\s-]dia)\s+e\s+meia\s*/, () => { out.start = '12:30'; atWord = true; });

    // lembrete (antes da duração, para "1h antes" não virar duração)
    take(/\s(?:lembrar|lembrete|avisar|aviso|me\s+avisa|me\s+lembra)\s*(?:me\s+)?(\d{1,3})\s*(h|horas?|min|minutos?)\s*antes\s*/, m => { out.remind = /^h/.test(m[2]) ? +m[1] * 60 : +m[1]; });
    take(/\s(?:lembrar|lembrete|avisar)\s*(?:me\s+)?(?:na\s+hora|no\s+horario)\s*/, () => { out.remind = 0; });

    // duração explícita
    take(/\s(?:por|durante)\s+(\d{1,2})\s*h(?!ora)\s*(\d{2})?\s*/, m => { out.dur = +m[1] * 60 + (+m[2] || 0); });
    take(/\s(?:por|durante)\s+(\d{1,3})\s*(?:min|minutos?)\s*/, m => { out.dur = +m[1]; });
    take(/\s(?:por|durante)\s+(\d{1,2})\s*(?:horas?|h)\s*/, m => { out.dur = +m[1] * 60; });
    take(/\s(\d{1,3})\s*(?:min|minutos?)\s*/, m => { out.dur = +m[1]; });
    take(/\s(\d{1,2})\s*horas?\s*/, m => { out.dur = +m[1] * 60; });
    take(/\s(meia\s+hora)\s*/, () => { out.dur = 30; });
    take(/\s(uma\s+hora)\s*/, () => { out.dur = 60; });

    // repetição
    take(/\s(?:toda|todas\s+as|todo)\s+(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)s?(?:-feira)?\s*/, m => { out.repeat = { kind: 'weekly', dow: DOW[m[1]] }; out.date = nextDow(todayS, DOW[m[1]], true); });
    take(/\s(?:todo\s+dia|todos\s+os\s+dias|diariamente|diario)\s*/, () => { out.repeat = { kind: 'daily' }; });
    take(/\s(?:toda\s+semana|semanal(?:mente)?)\s*/, () => { out.repeat = { kind: 'weekly' }; });

    // data
    take(/\s(hoje|hj)\s*/, () => { out.date = todayS; });
    take(/\s(depois\s+de\s+amanha)\s*/, () => { out.date = S.addDays(todayS, 2); });
    take(/\s(amanha)\s*/, () => { out.date = S.addDays(todayS, 1); });
    take(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*/, m => {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
      let d = S.ymd(new Date(y, +m[2] - 1, +m[1]));
      if (d < todayS && !m[3]) d = S.ymd(new Date(y + 1, +m[2] - 1, +m[1]));
      out.date = d;
    });
    take(/\s(?:dia\s+)?(\d{1,2})\s+de\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\w*\s*/, m => {
      const y = new Date().getFullYear(); let d = S.ymd(new Date(y, MON[m[2]], +m[1]));
      if (d < todayS) d = S.ymd(new Date(y + 1, MON[m[2]], +m[1]));
      out.date = d;
    });
    take(/\s(?:na\s+|no\s+|proxima\s+|proximo\s+|nesta\s+|neste\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)(?:-feira)?\s*/, m => { out.date = nextDow(todayS, DOW[m[1]], false); });
    take(/\sdia\s+(\d{1,2})\s*/, m => { const d = new Date(); let c = new Date(d.getFullYear(), d.getMonth(), +m[1]); if (S.ymd(c) < todayS) c = new Date(d.getFullYear(), d.getMonth() + 1, +m[1]); out.date = S.ymd(c); });

    // hora (pode haver mais de uma: "das 14h às 16h", "7h 1h")
    for (let i = 0; i < 3; i++) {
      const ok = take(/\s(as|a\s+partir\s+das|a\s+partir\s+de|das|de)?\s*(\d{1,2})\s*[h:]\s*(\d{2})\s*/, m => { atWord = atWord || /^(as|a)/.test(m[1] || ''); setTime(+m[2], +m[3], m[1]); })
        || take(/\s(as|das|de)\s+(\d{1,2})\s*h?\s*/, m => { atWord = atWord || /^a/.test(m[1]); setTime(+m[2], 0, m[1]); })
        || take(/\s(\d{1,2})\s*h\s*/, m => { setTime(+m[1], 0, ''); });
      if (!ok) break;
    }
    take(/\s(meio[\s-]dia)\s*/, () => { out.start = '12:00'; });
    take(/\s(?:de|pela|na)\s+manha\s*/, () => { if (!out.start) out.start = '09:00'; });
    take(/\s(?:de|a|pela|na)\s+tarde\s*/, () => { if (!out.start) out.start = '14:00'; });
    take(/\s(?:de|a|pela|na)\s+noite\s*/, () => { if (!out.start) out.start = '19:00'; });

    function setTime(h, m, word) {
      const total = h * 60 + m;
      // "2h" ou "1h30" sem "às" são mais prováveis como duração do que como 02:00
      if (h <= 5 && !/^a/.test(word || '') && (out.dur === null || out.start !== null)) { if (out.dur === null) out.dur = total; return; }
      if (out.start === null) { out.start = fix(h, m); return; }
      // segunda hora depois da primeira = hora de término
      const s = +out.start.slice(0, 2) * 60 + +out.start.slice(3);
      if (total > s && out.dur === null) out.dur = total - s;
    }

    // ritmo / esforço
    take(/\s(leve|rapido|rapida|facil)\s*/, () => { out.effort = 'leve'; });
    take(/\s(intenso|intensa|pesado|pesada|com\s+foco|concentrado)\s*/, () => { out.effort = 'intenso'; });

    // fixo / flexível
    take(/\s(fixo|fixa)\s*/, () => { out.fixed = true; });
    take(/\s(flexivel|quando\s+der|qualquer\s+hora)\s*/, () => { out.fixed = false; });

    // título = o que sobrou do texto original
    let title = '';
    for (let i = 0; i < raw.length; i++) title += mask[i + 1] ? ' ' : raw[i];
    title = title.replace(/\s*[,;]\s*/g, ', ').replace(/\s+/g, ' ').replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '').trim();
    const parts = title.split(', ').map(p => p.trim()).filter(p => p && !/^(e|as|às|de|do|da|no|na|em|para|pra)$/.test(p));
    out.title = cap(parts.shift() || 'Nova tarefa');
    if (parts.length) out.note = parts.join(', ');

    if (out.fixed === null) out.fixed = !!out.start && (atWord || FIXED_WORDS.test(norm(out.title)));
    if (out.dur === null) out.dur = out.fixed ? 60 : 30;
    if (out.effort === null) out.effort = out.dur >= 90 ? 'intenso' : (out.dur <= 15 ? 'leve' : 'normal');
    return out;
  }

  function nextDow(fromS, dow, strictFuture) {
    const S = global.Store; const d = S.parseYmd(fromS);
    let diff = (dow - d.getDay() + 7) % 7;
    if (diff === 0 && strictFuture) diff = 7;
    d.setDate(d.getDate() + diff); return S.ymd(d);
  }
  function fix(h, m) { if (h > 23) h = 23; if (m > 59) m = 59; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  global.Parse = { parse };
})(window);

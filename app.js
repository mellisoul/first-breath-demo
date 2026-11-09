(() => {
  const FS = 20;
  const STORE = 'firstbreath.sessions.v1';
  const RING = 2 * Math.PI * 140;
  const EXERCISES = [
    { id: 'diaphragm', steps: [{ k: 'inhale', d: 4 }, { k: 'exhale', d: 6 }] },
    { id: 'pursed', steps: [{ k: 'inhale', d: 2 }, { k: 'exhale', d: 4 }] },
    { id: 'calm', steps: [{ k: 'inhale', d: 4 }, { k: 'hold', d: 1 }, { k: 'exhale', d: 4 }] }
  ];

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  let lang = 'ru';
  let exId = 'diaphragm';
  let minutes = 3;
  let soundOn = true;
  let run = null;
  let last = null;
  let toneCtx = null;

  const store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { return []; }
    },
    save(list) {
      try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (e) {}
    },
    get(k, d) {
      try { return localStorage.getItem(k) ?? d; } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(k, v); } catch (e) {}
    }
  };

  const t = (k) => (I18N[lang] && I18N[lang][k] !== undefined ? I18N[lang][k] : I18N.ru[k] !== undefined ? I18N.ru[k] : k);

  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

  function borgText(v) {
    const n = Number(v);
    const key = n >= 10 ? 'borg10' : n >= 7 ? 'borg7' : n >= 5 ? 'borg5' : 'borg' + n;
    return '<b>' + n + '</b>' + t(key);
  }

  function applyLang() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
    $$('#durList button').forEach((b) => { b.dataset.unit = t('minUnit'); });
    renderExercises();
    renderWeek();
    updateBorg();
    if ($('#report').classList.contains('active')) renderReport();
    if (run) {
      $('#exName').textContent = t('ex_' + run.ex.id);
      setHint(run.hintKey, true);
    }
  }

  function renderExercises() {
    const box = $('#exList');
    box.innerHTML = '';
    EXERCISES.forEach((ex) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice' + (ex.id === exId ? ' on' : '');
      b.innerHTML = '<div><b></b><small></small></div><span class="pat"></span>';
      b.querySelector('b').textContent = t('ex_' + ex.id);
      b.querySelector('small').textContent = t('ex_' + ex.id + '_d');
      b.querySelector('.pat').textContent = ex.steps.map((s) => s.d).join('–');
      b.addEventListener('click', () => { exId = ex.id; renderExercises(); });
      box.appendChild(b);
    });
  }

  function dayKey(d) {
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function renderWeek() {
    const box = $('#week');
    const done = new Set(store.load().map((s) => dayKey(new Date(s.date))));
    const names = t('days');
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    box.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - mondayOffset + i);
      const el = document.createElement('div');
      if (done.has(dayKey(d))) el.classList.add('done');
      if (i === mondayOffset) el.classList.add('today');
      el.innerHTML = '<span></span><i></i>';
      el.querySelector('span').textContent = names[i];
      box.appendChild(el);
    }
  }

  function updateBorg() {
    ['Pre', 'Post'].forEach((k) => {
      const inp = $('#borg' + k);
      $('#borg' + k + 'Lab').innerHTML = borgText(inp.value);
      inp.style.setProperty('--fill', (Number(inp.value) * 10) + '%');
    });
  }

  function show(id) {
    $$('.work .screen').forEach((s) => s.classList.toggle('active', s.id === id));
    $$('.tab-btn').forEach((b) => b.classList.toggle('on', b.dataset.go === id || (b.dataset.go === 'setup' && ['session', 'post', 'summary'].includes(id))));
    if (id === 'report') renderReport();
    if (id === 'setup') renderWeek();
  }

  function scrollToApp() {
    const top = $('#app').getBoundingClientRect().top + window.scrollY - 64;
    if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top, behavior: 'smooth' });
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function tone(kind) {
    if (!soundOn) return;
    try {
      if (!toneCtx) toneCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (toneCtx.state === 'suspended') toneCtx.resume();
      const now = toneCtx.currentTime;
      const o = toneCtx.createOscillator();
      const g = toneCtx.createGain();
      const from = kind === 'inhale' ? 392 : kind === 'exhale' ? 523 : 440;
      const to = kind === 'inhale' ? 523 : kind === 'exhale' ? 349 : 440;
      o.type = 'sine';
      o.frequency.setValueAtTime(from, now);
      o.frequency.exponentialRampToValueAtTime(to, now + 0.45);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.07, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      o.connect(g).connect(toneCtx.destination);
      o.start(now);
      o.stop(now + 0.65);
    } catch (e) {}
    try { navigator.vibrate?.(kind === 'exhale' ? [20, 60, 20] : 30); } catch (e) {}
  }

  async function start(sim) {
    const ex = EXERCISES.find((e) => e.id === exId);
    const r = {
      ex,
      sim,
      pacer: new Pacer(ex.steps),
      an: new BreathAnalyzer(FS),
      t0: 0,
      nextT: -3,
      acc: 0,
      accN: 0,
      cycles: new Map(),
      evaluated: [],
      rates: [],
      regs: [],
      hintKey: 'calibrating',
      hintAt: 0,
      lastStat: 0,
      lastPhase: '',
      raf: 0,
      dur: minutes * 60,
      borgPre: Number($('#borgPre').value),
      stream: null,
      ctx: null,
      analyser: null,
      buf: null,
      wake: null
    };

    if (soundOn && !toneCtx) {
      try { toneCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }

    if (!sim) {
      try {
        r.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
      } catch (e) {
        toast(t('micDenied'));
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      r.ctx = new AC();
      await r.ctx.resume();
      const src = r.ctx.createMediaStreamSource(r.stream);
      const hp = r.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 150;
      const lp = r.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2500;
      r.analyser = r.ctx.createAnalyser();
      r.analyser.fftSize = 1024;
      r.buf = new Float32Array(r.analyser.fftSize);
      src.connect(hp).connect(lp).connect(r.analyser);
    }

    try { r.wake = await navigator.wakeLock?.request('screen'); } catch (e) {}

    run = r;
    $('#simBadge').hidden = !sim;
    $('#exName').textContent = t('ex_' + ex.id);
    ['#rate', '#reg', '#adh'].forEach((s) => { $(s).textContent = '—'; });
    setHint('calibrating', true);
    show('session');
    scrollToApp();
    lastFrame = 0;
    r.t0 = performance.now() + 3000;
    r.raf = requestAnimationFrame(tick);
  }

  function micRms(r) {
    r.analyser.getFloatTimeDomainData(r.buf);
    let s = 0;
    for (let i = 0; i < r.buf.length; i++) s += r.buf[i] * r.buf[i];
    return s / r.buf.length;
  }

  function tick(now) {
    const r = run;
    if (!r) return;
    const tSec = (now - r.t0) / 1000;

    if (!r.sim) {
      r.acc += micRms(r);
      r.accN++;
    }

    while (r.nextT <= tSec) {
      let rms;
      if (r.sim) {
        rms = r.nextT < 0 ? 0.0025 * (0.75 + 0.5 * Math.random()) : simulatedRms(r.nextT, r.pacer);
      } else {
        rms = Math.sqrt(r.accN ? r.acc / r.accN : 0);
        r.acc = 0;
        r.accN = 0;
      }
      const active = r.an.push(rms);
      if (r.nextT >= 0) account(r, r.nextT, active);
      r.nextT += 1 / FS;
    }

    const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    const lv = r.an.level.length ? r.an.level[r.an.level.length - 1] : 0;
    const cnt = $('#count');
    if (tSec < 0) {
      cnt.hidden = false;
      cnt.textContent = String(Math.ceil(-tSec));
      drawLungs(0, 0, dt, lv);
      $('#phaseText').textContent = '';
      $('#phaseCount').textContent = '';
      drawWave(r);
      r.raf = requestAnimationFrame(tick);
      return;
    }
    cnt.hidden = true;

    const p = r.pacer.at(tSec);
    if (p.kind + p.cycle !== r.lastPhase) {
      r.lastPhase = p.kind + p.cycle;
      tone(p.kind);
    }
    const b = p.kind === 'inhale' ? ease(p.prog) : p.kind === 'hold' ? 1 : 1 - ease(p.prog);
    drawLungs(b, p.prog, dt, lv);
    $('#phaseText').textContent = t(p.kind);
    $('#phaseCount').textContent = Math.ceil(p.remain);
    $('#hear').classList.toggle('on', r.an.active);
    $('#hear span').textContent = r.an.active ? t('hearOn') : t('hearOff');
    $('#timer').textContent = fmt(Math.max(0, r.dur - tSec));
    $('#prog').style.width = Math.min(100, 100 * tSec / r.dur).toFixed(2) + '%';
    drawWave(r);

    if (tSec - r.lastStat >= 1) {
      r.lastStat = tSec;
      updateStats(r, tSec);
    }

    if (tSec >= r.dur) {
      finish();
      return;
    }
    r.raf = requestAnimationFrame(tick);
  }

  function drawLungs(b, prog, dt, lv) {
    if (vizS) vizS.frame(b, dt || 0, r_level(lv));
    $('#ring').style.strokeDashoffset = (RING * (1 - prog)).toFixed(1);
  }

  function r_level(lv) {
    if (run && run.sim) return 0.7;
    return Math.max(0.15, Math.min(1, lv === undefined ? 0.5 : lv));
  }

  function account(r, ts, active) {
    const p = r.pacer.at(ts);
    let c = r.cycles.get(p.cycle);
    if (!c) {
      c = { ex: 0, exLen: 0, any: 0 };
      r.cycles.set(p.cycle, c);
      const prev = r.cycles.get(p.cycle - 1);
      if (prev) {
        if (prev.any >= 0.3) r.evaluated.push(prev.ex >= 0.6 * prev.exLen);
        r.cycles.delete(p.cycle - 1);
      }
    }
    if (p.kind === 'exhale') {
      c.exLen = p.dur;
      if (active) c.ex += 1 / FS;
    }
    if (active) c.any += 1 / FS;
  }

  function updateStats(r, tSec) {
    const est = r.an.estimate();
    if (est && est.rate >= 4 && est.rate <= 40) {
      if (tSec > 20) {
        r.rates.push(est.rate);
        r.regs.push(est.regularity);
      }
      $('#rate').textContent = Math.round(est.rate);
      $('#reg').textContent = Math.round(est.regularity * 100) + '%';
    }
    const ev = r.evaluated;
    if (ev.length) $('#adh').textContent = Math.round(100 * ev.filter(Boolean).length / ev.length) + '%';

    let key;
    if (r.an.calibrating) key = 'calibrating';
    else if (tSec > 8 && r.an.activeSeconds(9) < 0.3) key = 'hintNoSound';
    else if (ev.length && !ev[ev.length - 1]) key = 'hintLonger';
    else if (est && est.rate > r.pacer.rate + 4) key = 'hintSlower';
    else if (r.ex.id === 'pursed' && tSec < 15) key = 'hintFollow';
    else if (est && est.regularity >= 0.55) key = 'hintGood';
    else key = 'hintSteady';

    if (key !== r.hintKey && (tSec - r.hintAt >= 3 || r.hintKey === 'calibrating')) {
      r.hintAt = tSec;
      setHint(key);
    }
  }

  function setHint(key, silent) {
    if (run) run.hintKey = key;
    const box = $('#aiHint');
    $('#hintText').textContent = t(key);
    if (!silent) {
      box.classList.remove('pulse');
      void box.offsetWidth;
      box.classList.add('pulse');
    }
  }

  function drawWave(r) {
    const cv = $('#wave');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(cv.clientWidth * dpr);
    const h = Math.round(cv.clientHeight * dpr);
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    const lv = r.an.level;
    const ac = r.an.act;
    const span = FS * 20;
    const n = Math.min(lv.length, span);
    const start = lv.length - n;
    const dx = w / (span - 1);
    const x0 = w - (n - 1) * dx;
    const pad = 8 * dpr;
    const y = (v) => h - pad - 0.85 * v * (h - 2 * pad);

    g.fillStyle = 'rgba(159,211,207,0.10)';
    for (let i = 0; i < n; i++) {
      if (ac[start + i]) g.fillRect(x0 + i * dx - dx / 2, 0, dx + 0.5, h);
    }
    if (n < 2) return;
    g.beginPath();
    g.moveTo(x0, h);
    for (let i = 0; i < n; i++) g.lineTo(x0 + i * dx, y(lv[start + i]));
    g.lineTo(x0 + (n - 1) * dx, h);
    g.closePath();
    g.fillStyle = 'rgba(159,211,207,0.12)';
    g.fill();
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const xx = x0 + i * dx;
      const yy = y(lv[start + i]);
      if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.strokeStyle = '#9FD3CF';
    g.lineWidth = 2 * dpr;
    g.lineJoin = 'round';
    g.stroke();
  }

  function median(a) {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function fmt(sec) {
    const s = Math.round(sec);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function dm(d) {
    return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function stopAudio(r) {
    cancelAnimationFrame(r.raf);
    if (r.stream) r.stream.getTracks().forEach((tr) => tr.stop());
    if (r.ctx) r.ctx.close().catch(() => {});
    if (r.wake) r.wake.release().catch(() => {});
  }

  function finish() {
    const r = run;
    if (!r) return;
    stopAudio(r);
    run = null;
    const elapsed = Math.max(0, Math.min(r.dur, (performance.now() - r.t0) / 1000));
    const ev = r.evaluated;
    last = {
      ex: r.ex.id,
      sim: r.sim,
      elapsed,
      rate: median(r.rates),
      reg: median(r.regs),
      adh: ev.length ? ev.filter(Boolean).length / ev.length : null,
      borgPre: r.borgPre
    };
    $('#borgPost').value = String(r.borgPre);
    updateBorg();
    show('post');
  }

  function toSummary() {
    const s = last;
    if (!s) return show('setup');
    s.borgPost = Number($('#borgPost').value);
    $('#sumDur').textContent = fmt(s.elapsed);
    $('#sumRate').textContent = s.rate ? s.rate.toFixed(1) : '—';
    $('#sumReg').textContent = s.reg !== null ? Math.round(s.reg * 100) + '%' : '—';
    $('#sumAdh').textContent = s.adh !== null ? Math.round(s.adh * 100) + '%' : '—';
    $('#sumBorg').textContent = s.borgPre + ' → ' + s.borgPost;

    let next = 'nextKeep';
    if (s.borgPost - s.borgPre >= 2) next = 'nextRest';
    else if (s.adh !== null && s.reg !== null && s.adh >= 0.7 && s.reg >= 0.55) next = 'nextUp';
    else if (s.adh !== null && s.adh < 0.3) next = 'nextEasy';
    $('#sumNext').textContent = t(next);

    if (s.elapsed >= 20 && s.rate) {
      const list = store.load();
      list.push({
        date: new Date().toISOString(),
        ex: s.ex,
        min: Math.round(s.elapsed / 6) / 10,
        rate: Math.round(s.rate * 10) / 10,
        reg: s.reg !== null ? Math.round(s.reg * 100) : null,
        adh: s.adh !== null ? Math.round(s.adh * 100) : null,
        borgPre: s.borgPre,
        borgPost: s.borgPost,
        sim: s.sim
      });
      store.save(list);
      toast(t('saved'));
    } else {
      toast(t('tooShort'));
    }
    last = null;
    show('summary');
  }

  function renderReport() {
    const list = store.load().sort((a, b) => a.date.localeCompare(b.date));
    const real = list.filter((s) => !s.sim);
    const name = $('#patient').value.trim();
    const today = new Date();
    $('#repPatient').textContent = (name || t('patientNone')) + ' · ' + dm(today) + '.' + today.getFullYear();
    const weekAgo = Date.now() - 7 * 864e5;
    $('#repCount').textContent = real.filter((s) => new Date(s.date).getTime() >= weekAgo).length;
    const norm = real.length >= 3 ? median(real.slice(0, 3).map((s) => s.rate)) : null;
    const lastRate = real.length ? real[real.length - 1].rate : null;
    $('#repNorm').textContent = norm ? norm.toFixed(1) : '—';
    $('#repLast').textContent = lastRate ? lastRate.toFixed(1) : '—';
    const withBorg = real.filter((s) => typeof s.borgPre === 'number' && typeof s.borgPost === 'number');
    if (withBorg.length) {
      const avg = withBorg.reduce((a, s) => a + (s.borgPost - s.borgPre), 0) / withBorg.length;
      $('#repBorg').textContent = (avg > 0 ? '+' : avg < 0 ? '−' : '') + Math.abs(avg).toFixed(1);
    } else $('#repBorg').textContent = '—';

    const flag = $('#repFlag');
    flag.className = 'flag';
    if (!real.length) flag.textContent = '';
    else if (!norm) flag.textContent = t('flagFew');
    else if (lastRate - norm >= 3) {
      flag.classList.add('warn');
      flag.textContent = t('flagHigh').replace('{n}', (lastRate - norm).toFixed(1));
    } else flag.textContent = t('flagOk');

    const tb = $('#repRows');
    tb.innerHTML = '';
    [...list].reverse().forEach((s) => {
      const tr = document.createElement('tr');
      const cells = [
        dm(new Date(s.date)),
        t('ex_' + s.ex),
        String(s.min),
        s.rate.toFixed(1),
        s.reg !== null && s.reg !== undefined ? s.reg + '%' : '—',
        typeof s.borgPre === 'number' ? s.borgPre + '→' + s.borgPost : '—'
      ];
      cells.forEach((c, i) => {
        const td = document.createElement('td');
        td.textContent = c;
        if (i === 1 && (s.sample || s.sim)) {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = s.sample ? t('sample') : t('simTag');
          td.appendChild(tag);
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    $('#repEmpty').style.display = list.length ? 'none' : 'block';
    $('.tbl').style.display = list.length ? '' : 'none';
    requestAnimationFrame(() => drawTrend(real.slice(-14), norm));
  }

  function drawTrend(list, norm) {
    const cv = $('#trend');
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(cv.clientWidth * dpr) || 900;
    const h = Math.round(cv.clientHeight * dpr) || 360;
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    if (!list.length) return;
    const vals = list.map((s) => s.rate);
    const lo = Math.floor(Math.min(...vals, norm || 99) - 2);
    const hi = Math.ceil(Math.max(...vals, norm || 0) + 2);
    const L = 36 * dpr;
    const R = 16 * dpr;
    const T = 18 * dpr;
    const B = 26 * dpr;
    const X = (i) => L + (list.length === 1 ? (w - L - R) / 2 : i * (w - L - R) / (list.length - 1));
    const Y = (v) => T + (hi - v) * (h - T - B) / (hi - lo);

    g.font = (12 * dpr) + 'px "Golos Text", Arial';
    g.fillStyle = '#4C5C6C';
    g.strokeStyle = '#E4E9EE';
    g.lineWidth = dpr;
    const step = Math.max(1, Math.round((hi - lo) / 4));
    for (let v = lo; v <= hi; v += step) {
      g.beginPath();
      g.moveTo(L, Y(v));
      g.lineTo(w - R, Y(v));
      g.stroke();
      g.fillText(String(v), 8 * dpr, Y(v) + 4 * dpr);
    }

    const grad = g.createLinearGradient(0, T, 0, h - B);
    grad.addColorStop(0, 'rgba(69,91,114,0.16)');
    grad.addColorStop(1, 'rgba(69,91,114,0)');
    g.beginPath();
    list.forEach((s, i) => { if (i === 0) g.moveTo(X(i), Y(s.rate)); else g.lineTo(X(i), Y(s.rate)); });
    g.lineTo(X(list.length - 1), h - B);
    g.lineTo(X(0), h - B);
    g.closePath();
    g.fillStyle = grad;
    g.fill();

    if (norm) {
      g.setLineDash([6 * dpr, 6 * dpr]);
      g.strokeStyle = '#B4533A';
      g.lineWidth = 1.2 * dpr;
      g.beginPath();
      g.moveTo(L, Y(norm));
      g.lineTo(w - R, Y(norm));
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#B4533A';
      const lab = t('norm').split(',')[0];
      g.fillText(lab, w - R - g.measureText(lab).width, Y(norm) - 6 * dpr);
    }

    g.strokeStyle = '#455B72';
    g.lineWidth = 2.2 * dpr;
    g.lineJoin = 'round';
    g.beginPath();
    list.forEach((s, i) => { if (i === 0) g.moveTo(X(i), Y(s.rate)); else g.lineTo(X(i), Y(s.rate)); });
    g.stroke();
    list.forEach((s, i) => {
      g.beginPath();
      g.arc(X(i), Y(s.rate), 3.5 * dpr, 0, Math.PI * 2);
      g.fillStyle = i === list.length - 1 ? '#18222D' : '#455B72';
      g.fill();
    });

    g.fillStyle = '#4C5C6C';
    list.forEach((s, i) => {
      if (list.length > 8 && i % 2 && i !== list.length - 1) return;
      const lab = dm(new Date(s.date));
      g.fillText(lab, X(i) - g.measureText(lab).width / 2, h - 7 * dpr);
    });
  }

  function seed() {
    const rates = [18.6, 18.1, 17.6, 17.0, 16.4, 15.9, 15.4];
    const regs = [52, 57, 61, 66, 70, 73, 77];
    const mins = [3, 3, 3, 4, 4, 5, 5];
    const pre = [5, 5, 4, 4, 4, 3, 3];
    const post = [4, 3, 3, 3, 2, 2, 1];
    const exs = ['calm', 'diaphragm', 'pursed', 'diaphragm', 'pursed', 'diaphragm', 'diaphragm'];
    const list = store.load().filter((s) => !s.sample);
    rates.forEach((r, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(9, 30, 0, 0);
      list.push({ date: d.toISOString(), ex: exs[i], min: mins[i], rate: r, reg: regs[i], adh: 60 + i * 5, borgPre: pre[i], borgPost: post[i], sample: true });
    });
    store.save(list);
    renderReport();
    renderWeek();
    toast(t('seeded'));
  }

  function exportCsv() {
    const list = store.load().sort((a, b) => a.date.localeCompare(b.date));
    const head = ['date', 'exercise', 'minutes', 'rate_per_min', 'regularity_pct', 'exhale_ok_pct', 'borg_pre', 'borg_post', 'source'];
    const rows = list.map((s) => [
      s.date.slice(0, 16).replace('T', ' '),
      s.ex,
      s.min,
      s.rate,
      s.reg ?? '',
      s.adh ?? '',
      s.borgPre ?? '',
      s.borgPost ?? '',
      s.sample ? 'sample' : s.sim ? 'demo' : 'mic'
    ]);
    const csv = [head, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'first-breath-report.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function heroTrace() {
    const cv = $('#heroTrace');
    const ph = $('#heroPhase');
    if (!cv) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vol = (s) => {
      const c = ((s % 10) + 10) % 10;
      return c < 4 ? ease(c / 4) : 1 - ease((c - 4) / 6);
    };
    const span = 30;
    const lc = $('#heroLungs');
    if (lc && typeof LungsViz !== 'undefined') vizH = new LungsViz(lc, { particles: 80 });
    let prev = 0;
    const draw = (now) => {
      const hdt = prev ? (now - prev) / 1000 : 0;
      prev = now;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(cv.clientWidth * dpr);
      const h = Math.round(cv.clientHeight * dpr);
      if (!w || !h) return;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const g = cv.getContext('2d');
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(159,211,207,0.08)';
      g.lineWidth = dpr;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, h * i / 6); g.lineTo(w, h * i / 6); g.stroke(); }
      for (let i = 1; i < 15; i++) { g.beginPath(); g.moveTo(w * i / 15, 0); g.lineTo(w * i / 15, h); g.stroke(); }
      const tNow = reduce ? 9 : now / 1000;
      const headX = w * 0.82;
      const pad = h * 0.16;
      const Y = (v) => h - pad - v * (h - 2 * pad);
      g.beginPath();
      for (let x = 0; x <= headX; x += 2 * dpr) {
        const s = tNow - (headX - x) / headX * span * 0.82;
        const v = vol(s) + 0.015 * Math.sin(s * 9);
        if (x === 0) g.moveTo(x, Y(v)); else g.lineTo(x, Y(v));
      }
      g.strokeStyle = '#9FD3CF';
      g.lineWidth = 2.2 * dpr;
      g.lineJoin = 'round';
      g.stroke();
      const hv = vol(tNow);
      g.fillStyle = '#E9B064';
      g.beginPath();
      g.arc(headX, Y(hv), 4.5 * dpr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(233,176,100,0.35)';
      g.beginPath();
      g.moveTo(headX, 0);
      g.lineTo(headX, h);
      g.stroke();
      const c = ((tNow % 10) + 10) % 10;
      if (ph) ph.textContent = c < 4 ? t('inhale') : t('exhale');
      if (vizH && lc.offsetParent !== null) vizH.frame(hv, reduce ? 0 : hdt, 0.75);
      if (!reduce) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  let vizS = null;
  let vizH = null;
  let lastFrame = 0;

  function inlineLungs() {
    vizS = new LungsViz($('#sLungs'), { particles: 110 });
    vizS.frame(0, 0, 0.5);
  }

  function init() {
    inlineLungs();
    lang = store.get('firstbreath.lang', 'ru') === 'kk' ? 'kk' : 'ru';
    soundOn = store.get('firstbreath.sound', '1') !== '0';
    $$('#soundSeg button').forEach((b) => b.classList.toggle('on', (b.dataset.sound === '1') === soundOn));
    $('#patient').value = store.get('firstbreath.patient', '');
    $('#patient').addEventListener('input', (e) => store.set('firstbreath.patient', e.target.value));

    $$('.lang button').forEach((b) => b.addEventListener('click', () => {
      lang = b.dataset.lang;
      store.set('firstbreath.lang', lang);
      applyLang();
    }));

    $$('#durList button').forEach((b) => b.addEventListener('click', () => {
      minutes = Number(b.dataset.min);
      $$('#durList button').forEach((x) => x.classList.toggle('on', x === b));
    }));

    $$('#soundSeg button').forEach((b) => b.addEventListener('click', () => {
      soundOn = b.dataset.sound === '1';
      store.set('firstbreath.sound', soundOn ? '1' : '0');
      $$('#soundSeg button').forEach((x) => x.classList.toggle('on', x === b));
      if (soundOn) tone('inhale');
    }));

    $('#borgPre').addEventListener('input', updateBorg);
    $('#borgPost').addEventListener('input', updateBorg);

    $$('[data-go]').forEach((b) => b.addEventListener('click', () => {
      if (run) {
        stopAudio(run);
        run = null;
      }
      show(b.dataset.go);
    }));

    $('#startMic').addEventListener('click', () => start(false));
    $('#startSim').addEventListener('click', () => start(true));
    $('#stop').addEventListener('click', finish);
    $('#toSummary').addEventListener('click', toSummary);
    $('#print').addEventListener('click', () => window.print());
    $('#csv').addEventListener('click', exportCsv);
    $('#seed').addEventListener('click', seed);
    $('#clear').addEventListener('click', () => {
      store.save([]);
      renderReport();
      renderWeek();
      toast(t('cleared'));
    });
    window.addEventListener('resize', () => {
      if ($('#report').classList.contains('active')) renderReport();
    });

    applyLang();
    heroTrace();
    const params = new URLSearchParams(location.search);
    if (params.get('screen') === 'report') show('report');
    else show('setup');
  }

  init();
})();

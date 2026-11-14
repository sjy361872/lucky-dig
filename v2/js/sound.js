// =====================================================
//  사운드 — 파일 없이 Web Audio로 합성
// =====================================================
(function (root) {
  let ctx = null, sfxGain = null, bgmGain = null, bgmTimer = null;
  const vol = { bgm: 0.5, sfx: 0.8 };

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    sfxGain = ctx.createGain(); sfxGain.gain.value = vol.sfx; sfxGain.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.gain.value = vol.bgm * 0.25; bgmGain.connect(ctx.destination);
    return true;
  }
  function tone(freq, dur, type = 'square', v = 0.2, when = 0, slide = 0, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, v = 0.3, when = 0, filterFreq = 1200, ftype = 'lowpass') {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t);
  }

  function ring(f, dur, v, partials = [1, 2.76, 5.4], when = 0) {
    partials.forEach((m, i) => tone(f * m, dur * (1 - i * 0.25), i ? 'sine' : 'triangle', v / (i + 1), when));
  }
  // 재질별 타격음
  //  - 흙·풀: 둔탁한 퍽 / 돌·루비·폭발광석: 돌 깨는 딱 / 금: 맑은 금속음 / 다이아: 유리 같은 높은 울림
  //  - 흑요석: 단단하고 낮은 쨍 / ?블록: 상자 두드리는 깡
  //  hard = 단단할수록(내구도 높을수록) 높고 날카롭게, ratio = 많이 깨질수록 음이 올라가고 갈라지는 소리 추가
  const MAT = {
    grass: { kind: 'soft', f: 90 }, dirt: { kind: 'soft', f: 80 },
    stone: { kind: 'rock', f: 170 }, ruby: { kind: 'rock', f: 200, glint: 2600 }, explosive: { kind: 'rock', f: 150 },
    gold: { kind: 'metal', f: 1250, dur: 0.28 }, diamond: { kind: 'metal', f: 2350, dur: 0.38, partials: [1, 2.4, 3.9, 6.1] },
    obsidian: { kind: 'metal', f: 820, dur: 0.22, click: true }, mystery: { kind: 'metal', f: 620, dur: 0.2, partials: [1, 1.7, 3.1] },
  };
  function hitSound(o = {}) {
    const m = MAT[o.type] || MAT.stone, ratio = o.ratio || 0;
    const hard = (window.CONFIG && window.CONFIG.BLOCKS[o.type] ? window.CONFIG.BLOCKS[o.type].hp : 2) / 7; // 0.14 ~ 1
    const up = 1 + ratio * 0.18 + hard * 0.12;
    if (m.kind === 'soft') { noise(0.09, 0.4, 0, 500); tone(m.f * up, 0.1, 'sine', 0.35, 0, 0.6); return; }
    if (m.kind === 'rock') {
      noise(0.07, 0.45, 0, 1600 + hard * 1500); tone(m.f * up, 0.07, 'square', 0.12, 0, 0.55);
      if (m.glint) tone(m.glint * up, 0.06, 'triangle', 0.08, 0.01);
      if (ratio > 0.5) noise(0.12, 0.25 * ratio, 0.03, 900);          // 크게 금 가는 소리
      return;
    }
    noise(0.03, 0.35 + hard * 0.2, 0, 4000, 'highpass');                 // 금속 부딪히는 딱
    ring(m.f * up, (m.dur || 0.25) * (1 - ratio * 0.3), 0.16, m.partials);
    if (m.click) tone(120, 0.05, 'square', 0.15);                        // 흑요석: 묵직한 저음
    if (ratio > 0.5) noise(0.1, 0.2 * ratio, 0.04, 2500, 'bandpass');    // 깨지기 직전 갈라지는 소리
  }
  function breakSound(o = {}) {
    const m = MAT[o.type] || MAT.stone;
    if (m.kind === 'soft') { noise(0.18, 0.4, 0, 700); tone(70, 0.15, 'sine', 0.3); return; }
    if (m.kind === 'rock') { noise(0.25, 0.5, 0, 1100); tone(110, 0.18, 'triangle', 0.25, 0, 0.5); if (m.glint) [1600, 2400].forEach((f, i) => tone(f, 0.1, 'triangle', 0.12, 0.05 + i * 0.05)); return; }
    noise(0.3, 0.35, 0, 5000, 'highpass');
    [1, 1.26, 1.5, 2].forEach((k, i) => ring(m.f * k, 0.25, 0.08, [1, 2.76], i * 0.05)); // 반짝이며 부서지는 소리
  }

  const SFX = {
    click: () => tone(660, 0.06, 'square', 0.12),
    reel: () => tone(900 + Math.random() * 300, 0.03, 'square', 0.05),
    stop: () => tone(520, 0.08, 'triangle', 0.2),
    hit: o => hitSound(o),
    break: o => breakSound(o),
    gem: () => { tone(1320, 0.09, 'triangle', 0.15); tone(1760, 0.12, 'triangle', 0.12, 0.05); },
    big: () => [880, 1100, 1320, 1760].forEach((f, i) => tone(f, 0.15, 'triangle', 0.15, i * 0.05)),
    boom: () => { noise(0.5, 0.6, 0, 600); tone(90, 0.4, 'sine', 0.5, 0, 0.4); },
    spinUp: () => { tone(700, 0.08, 'square', 0.12); tone(1050, 0.12, 'square', 0.12, 0.07); },
    book: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, i * 0.06)),
    chest: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'square', 0.1, i * 0.07)); noise(0.3, 0.15, 0.4, 5000); },
    last: () => { tone(330, 0.25, 'sawtooth', 0.15); tone(440, 0.4, 'sawtooth', 0.15, 0.22); },
    drumroll: () => { for (let i = 0; i < 14; i++) tone(110 + i * 6, 0.05, 'square', 0.06 + i * 0.008, i * 0.06); },
    chestBig: () => { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.22, 'square', 0.11, i * 0.06)); noise(0.6, 0.2, 0.3, 6000); tone(65, 0.6, 'sine', 0.5); },
    tick: () => tone(1400, 0.03, 'square', 0.06),
    fanfare: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.6 : 0.16, 'square', 0.13, i * 0.12)),
    coin: () => { tone(988, 0.08, 'square', 0.12); tone(1319, 0.2, 'square', 0.12, 0.08); },
  };

  // 간단한 반복 BGM
  // ---------- BGM: 따뜻하고 평화로운 "시골 마을" 분위기 (자체 작곡) ----------
  // 느린 템포(100 BPM), D장조. 플루트 같은 멜로디 + 하프/마림바 같은 분산화음 + 부드러운 패드 + 베이스 + 쉐이커
  // 전체에 잔향(리버브)을 걸어 넓은 공간감을 줌
  const BPM = 100, EIGHTH = 60 / BPM / 2;
  const NOTE = n => {
    const m = n.match(/^([A-G])(#?)(\d)$/);
    const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (semi + (+m[3] + 1) * 12 - 69) / 12);
  };
  // 멜로디: [음, 8분음표 개수], '-' = 쉼 (마디마다 합 8)
  const SONG = [
    // A: 아침 햇살처럼 차분하게
    [['F#5',2],['A5',1],['D6',3],['C#6',1],['B5',1]],
    [['A5',4],['E5',2],['F#5',1],['G5',1]],
    [['F#5',2],['D5',1],['F#5',1],['B5',3],['A5',1]],
    [['G5',6],['-',2]],
    [['F#5',1],['G5',1],['A5',2],['D6',2],['E6',1],['F#6',1]],
    [['G6',2],['F#6',1],['E6',1],['D6',2],['B5',2]],
    [['A5',2],['B5',1],['G5',1],['E5',2],['F#5',1],['G5',1]],
    [['A5',6],['-',2]],
    // B: 살짝 설레는 느낌으로
    [['B5',2],['D6',2],['B5',1],['A5',1],['G5',2]],
    [['C#6',2],['E6',2],['C#6',1],['B5',1],['A5',2]],
    [['A5',2],['F#5',1],['A5',1],['C#6',3],['B5',1]],
    [['B5',4],['A5',2],['F#5',2]],
    [['G5',2],['B5',2],['D6',3],['C#6',1]],
    [['E6',2],['D6',1],['C#6',1],['A5',4]],
    [['E5',1],['F#5',1],['G5',1],['A5',1],['C#6',2],['E6',2]],
    [['D6',6],['-',2]],
  ];
  const CHORDS = [
    { n: ['D4','F#4','A4'], b: 'D2' }, { n: ['C#4','E4','A4'], b: 'C#2' }, { n: ['B3','D4','F#4'], b: 'B1' }, { n: ['B3','D4','G4'], b: 'G2' },
    { n: ['D4','F#4','A4'], b: 'D2' }, { n: ['B3','D4','G4'], b: 'G2' }, { n: ['B3','E4','G4'], b: 'E2' }, { n: ['C#4','E4','A4'], b: 'A1' },
    { n: ['B3','D4','G4'], b: 'G2' }, { n: ['C#4','E4','A4'], b: 'A2' }, { n: ['C#4','F#4','A4'], b: 'F#2' }, { n: ['B3','D4','F#4'], b: 'B1' },
    { n: ['B3','D4','G4'], b: 'G2' }, { n: ['C#4','E4','A4'], b: 'A2' }, { n: ['C#4','E4','G4'], b: 'A1' }, { n: ['D4','F#4','A4'], b: 'D2' },
  ];
  let bus = null;
  function makeBus() { // 원음 + 잔향
    bus = ctx.createGain();
    const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    bus.connect(bgmGain); bus.connect(conv); conv.connect(wet); wet.connect(bgmGain);
  }
  function env(g, t, v, a, dur, rel) {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + Math.max(a, dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur);
  }
  function flute(f, t, dur) { // 부드러운 플루트: 삼각파 + 옥타브 위 사인 + 비브라토
    const g = ctx.createGain(); env(g, t, 0.2, 0.05, dur, 0.12); g.connect(bus);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * 0.004; lfo.connect(lg);
    [['triangle', 1, 1], ['sine', 2, 0.18]].forEach(([type, mul, v]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = v;
      lg.connect(o.frequency); o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
    });
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  function pluck(f, t, v = 0.11) { // 하프·마림바 같은 튕기는 소리
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 4; // 나무 울림
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus);
    o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
  }
  function pad(notes, t, dur) { // 현악기 패드: 살짝 어긋난 톱니파 두 개를 부드럽게 걸러냄
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
    const g = ctx.createGain(); env(g, t, 0.05, 0.4, dur, 0.4); f.connect(g); g.connect(bus);
    for (const n of notes) for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  function bass(f, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f;
    env(g, t, 0.32, 0.01, dur, 0.08); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function shaker(t, v) {
    const len = Math.floor(ctx.sampleRate * 0.05), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = v; src.connect(f); f.connect(g); g.connect(bus); src.start(t);
  }
  function scheduleBar(bar, t0) {
    let t = t0;
    for (const [n, len] of SONG[bar]) { if (n !== '-') flute(NOTE(n), t, len * EIGHTH * 0.95); t += len * EIGHTH; }
    const ch = CHORDS[bar], bar8 = 8 * EIGHTH;
    pad(ch.n, t0, bar8);
    const arp = [0, 1, 2, 1, 0, 1, 2, 1].map(i => NOTE(ch.n[i]) * 2); // 한 옥타브 위에서 굴리는 분산화음
    arp.forEach((f, i) => pluck(f, t0 + i * EIGHTH, i % 2 ? 0.06 : 0.09));
    const root = NOTE(ch.b);
    bass(root, t0, EIGHTH * 3); bass(root * 1.5, t0 + EIGHTH * 3, EIGHTH); bass(root, t0 + EIGHTH * 4, EIGHTH * 3); bass(root * 2, t0 + EIGHTH * 7, EIGHTH);
    for (let i = 0; i < 8; i++) shaker(t0 + i * EIGHTH, i % 2 ? 0.05 : 0.09);
  }
  let nextBar = 0, barTime = 0;
  function startBgm() {
    if (!ensure() || bgmTimer) return;
    if (!bus) makeBus();
    nextBar = 0; barTime = ctx.currentTime + 0.15;
    bgmTimer = setInterval(() => {
      while (barTime < ctx.currentTime + 0.4) {
        scheduleBar(nextBar, barTime);
        barTime += 8 * EIGHTH;
        nextBar = (nextBar + 1) % SONG.length;
      }
    }, 60);
  }

  // ---------- 아이폰 대응 ----------
  //  1) 무음 스위치: 웹 오디오는 아이폰 무음 모드에서 소리가 안 남 → '재생' 종류로 지정(iOS 17+),
  //     구형은 무음 <audio> 를 같이 틀어 두면 미디어 재생으로 취급돼서 소리가 남
  //  2) 다른 앱에 갔다 오면 소리가 'interrupted'(중단)로 바뀜 → 다음 터치·화면 복귀 때 다시 켬
  const SILENT = 'data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
  let silentEl = null;
  function iosUnmute() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 지원 안 함 */ }
    try {
      if (!silentEl) { silentEl = document.createElement('audio'); silentEl.src = SILENT; silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.preload = 'auto'; }
      if (silentEl.paused) { const p = silentEl.play(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* 무시 */ }
  }
  function wake() {
    if (!ctx) return;
    if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
    iosUnmute();
  }
  ['touchend', 'pointerdown', 'keydown'].forEach(t => document.addEventListener(t, wake, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (silentEl) silentEl.pause(); }
    else wake();
  });

  root.Sound = {
    unlock() {
      if (!ensure()) return;
      iosUnmute();
      if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      // 구형 아이폰: 터치 안에서 빈 소리를 한 번 재생해야 완전히 열림
      try { const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0); } catch (e) { /* 무시 */ }
      startBgm();
    },
    play(name, opts) { if (!ctx || vol.sfx <= 0) return; try { SFX[name] && SFX[name](opts); } catch (e) { console.warn('sound error', name, e); } },
    setVolume(kind, v) {
      vol[kind] = v;
      if (!ctx) return;
      if (kind === 'sfx') sfxGain.gain.value = v;
      if (kind === 'bgm') bgmGain.gain.value = v * 0.25;
    },
    get volume() { return { ...vol }; },
  };
})(window);

// =====================================================
//  화면 그리기 + 엔진 기록(events) 재생
// =====================================================
(function (root) {
  const C = root.CONFIG, Art = root.Art, Sound = root.Sound;
  const CELL = 56, GAP = 24, BOARD_TOP = C.SLOT_ROWS * CELL + GAP;
  const $ = s => document.querySelector(s);
  const fmt = n => Math.round(n).toLocaleString('ko-KR');

  let slotEls = [], blockEls = [], chestEls = [], bet = 1000;
  let shownScore = 0, scoreTween = null;
  const state = { speed: 1, skipping: false };
  const wait = ms => new Promise(res => setTimeout(res, ms / (state.skipping ? 12 : state.speed)));
  const anim = (el, frames, ms, opts = {}) => {
    const dur = ms / (state.skipping ? 12 : state.speed);
    el.animate(frames, { duration: dur, easing: 'ease-out', fill: 'forwards', ...opts });
    return new Promise(res => setTimeout(res, dur)); // 애니메이션 길이만큼 타이머로 대기
  };
  const pos = (r, c, board) => ({ x: c * CELL, y: (board ? BOARD_TOP : 0) + r * CELL });

  // ---------- 고정 요소 ----------
  function buildSlot() {
    const slot = $('#slot');
    slot.innerHTML = '';
    slotEls = [];
    for (let r = 0; r < C.SLOT_ROWS; r++) {
      const row = [];
      for (let c = 0; c < C.COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'slot-cell';
        cell.style.left = c * CELL + 'px'; cell.style.top = r * CELL + 'px';
        slot.appendChild(cell);
        row.push(cell);
      }
      slotEls.push(row);
    }
  }
  function setSlotItem(r, c, type, cls = '') {
    const cell = slotEls[r][c];
    cell.innerHTML = type ? `<div class="slot-item ${cls}">${Art.item(type)}${C.PICKS[type] ? `<span class="badge">${C.PICKS[type].power}</span>` : ''}</div>` : '';
  }
  function clearSlot() { for (let r = 0; r < C.SLOT_ROWS; r++) for (let c = 0; c < C.COLS; c++) setSlotItem(r, c, null); }

  function drawBoard(board, chests) {
    const el = $('#board');
    el.innerHTML = '';
    blockEls = [];
    for (let r = 0; r < C.ROWS; r++) {
      const row = [];
      for (let c = 0; c < C.COLS; c++) {
        const hole = document.createElement('div');
        hole.className = 'hole';
        hole.style.left = c * CELL + 'px'; hole.style.top = r * CELL + 'px';
        el.appendChild(hole);
        const b = board[r][c];
        if (!b) { row.push(null); continue; }
        const d = document.createElement('div');
        d.className = 'block';
        d.dataset.type = b.type;
        d.style.left = c * CELL + 'px'; d.style.top = r * CELL + 'px';
        d.innerHTML = `${Art.block(b.type)}<div class="crack"></div>`;
        el.appendChild(d);
        row.push(d);
      }
      blockEls.push(row);
    }
    const ch = $('#chests');
    ch.innerHTML = '';
    chestEls = chests.map((cfg, c) => {
      const conf = C.CHESTS.find(x => x.min === cfg.min);
      const d = document.createElement('div');
      d.className = 'chest';
      d.title = cfg.min === 10 ? '10배 확정' : cfg.min + '배 이상';
      d.innerHTML = Art.chest(conf, cfg.opened) + (cfg.opened ? `<span class="mult">×${cfg.mult}</span>` : '');
      ch.appendChild(d);
      return d;
    });
  }

  // ---------- 등급 게이지 ----------
  // 9칸: [0~G) [G~F) ... [S~상한]  — 칸마다 같은 높이
  function bounds() { return C.GRADES.slice().reverse().map(g => g.need * bet); } // G..S
  function gaugeFrac(score) {
    const b = bounds(), seg = 1 / (b.length + 1);
    if (score < b[0]) return (score / b[0]) * seg;
    for (let i = 0; i < b.length; i++) {
      const lo = b[i], hi = i + 1 < b.length ? b[i + 1] : C.S_CAP * bet;
      if (score < hi || i === b.length - 1) return Math.min(1, seg * (i + 1) + seg * Math.min(1, (score - lo) / (hi - lo)));
    }
    return 1;
  }
  function buildGauge() {
    const box = $('#gaugeLabels');
    box.innerHTML = '';
    const seg = 100 / (C.GRADES.length + 1);
    C.GRADES.slice().reverse().forEach((g, i) => {
      const d = document.createElement('div');
      d.className = 'glabel';
      d.dataset.grade = g.id;
      d.style.bottom = `calc(${seg * (i + 1)}% - 10px)`;
      d.innerHTML = `<i class="gem" style="background:${g.color}"></i><span class="gname">${g.id}</span><small>×${g.need}</small>`;
      box.appendChild(d);
    });
  }
  function setGauge(score) {
    $('#gaugeFill').style.height = (gaugeFrac(score) * 100) + '%';
    const gi = root.Engine.gradeIndexForScore(score, bet);
    document.querySelectorAll('.glabel').forEach(el => el.classList.toggle('on', gi >= 0 && el.dataset.grade === C.GRADES[gi].id));
    setGoal(score, gi);
  }
  // 다음 등급까지 한 줄 ("금까지 260점 남음")
  function setGoal(score, gi) {
    const t = $('#goalText'); if (!t) return;
    const up = C.GRADES.slice().reverse();              // 흙 → 전설
    const next = up.find(g => g.need * bet > score);
    const gem = $('.goal-gem'), fill = $('#goalFill');
    if (!next) { t.innerHTML = `<b>${C.GRADES[0].name}</b> 등급 달성!`; if (gem) gem.style.background = C.GRADES[0].color; if (fill) fill.style.width = '100%'; return; }
    const prev = gi >= 0 ? C.GRADES[gi].need * bet : 0;
    t.innerHTML = `<b>${next.name}</b> 등급까지 <b>${fmt(Math.ceil(next.need * bet - score))}</b>점`;
    if (gem) gem.style.background = next.color;
    if (fill) fill.style.width = Math.max(0, Math.min(100, (score - prev) / (next.need * bet - prev) * 100)) + '%';
  }
  function setBet(b) { bet = b; buildGauge(); setGauge(0); }

  // ---------- 숫자 ----------
  function setScore(n, ms = 300) {
    const from = shownScore;
    shownScore = n;
    clearTimeout(scoreTween);
    const t0 = performance.now(), dur = ms / (state.skipping ? 12 : state.speed);
    const step = now => {
      const p = Math.max(0, Math.min(1, (now - t0) / dur));
      const v = from + (n - from) * (1 - Math.pow(1 - p, 3));
      const st = $('#scoreText'); st.textContent = fmt(v); st.classList.toggle('long', st.textContent.length > 9);
      setGauge(v);
      if (p < 1) scoreTween = setTimeout(() => step(performance.now()), 16);
    };
    step(performance.now());
  }
  function setSpins(n) {
    const el = $('#spinsText');
    el.textContent = n + '회';
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  // ---------- 효과 ----------
  function floatText(x, y, text, cls = '', ms = 1100) {
    const d = document.createElement('div');
    d.className = 'float ' + cls;
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    $('#fx').appendChild(d);
    anim(d, [{ transform: 'translate(-50%,0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-14px) scale(1.1)', opacity: 1, offset: .25 }, { transform: 'translate(-50%,-36px) scale(1)', opacity: 0 }], ms)
      .then(() => d.remove());
    return d;
  }
  function particles(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.background = color;
      p.style.left = x + 'px'; p.style.top = y + 'px';
      $('#fx').appendChild(p);
      const a = Math.random() * Math.PI * 2, dist = 20 + Math.random() * 30;
      anim(p, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist + 20}px) scale(.3)`, opacity: 0 }], 500 + Math.random() * 200)
        .then(() => p.remove());
    }
  }
  const BLOCK_COLOR = { grass: '#7c4a1e', dirt: '#a8692f', stone: '#8a8d94', ruby: '#e3193f', gold: '#f2b90f', diamond: '#7fd8f2', obsidian: '#a46bff', explosive: '#ff7a12', mystery: '#e21d4f' };
  function shake(el, amp = 4) {
    anim(el, [{ transform: 'translate(0,0)' }, { transform: `translate(${amp}px,0)` }, { transform: `translate(-${amp}px,0)` }, { transform: 'translate(0,0)' }], 160, { fill: 'none' });
  }
  async function banner(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'banner ' + cls;
    d.innerHTML = `<span>${text}</span>`;
    $('#stage').appendChild(d);
    await anim(d, [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1)', offset: .15 }, { opacity: 1, transform: 'scaleY(1)', offset: .85 }, { opacity: 0, transform: 'scaleY(0)' }], 1100);
    d.remove();
  }

  // ---------- 타격 파편 ----------
  const DEBRIS = {
    grass: ['#5ccb35', '#8a521c', '#b06d2b'], dirt: ['#b06d2b', '#7a4518', '#d08a45'],
    stone: ['#9196a0', '#6a6f78', '#c4c8cf'], ruby: ['#9196a0', '#ff2a55', '#6a6f78'],
    gold: ['#ffd23a', '#f5b90c', '#fff3a0'], diamond: ['#bff3ff', '#7fd8f2', '#ffffff'],
    obsidian: ['#33224f', '#5b4290', '#b98aff'], explosive: ['#2f2420', '#ff6a00', '#ffd25c'], mystery: ['#e8204f', '#ffffff', '#b8103a'],
  };
  function debris(x, y, type, n) {
    const cols = DEBRIS[type] || DEBRIS.stone;
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'chip-debris';
      const sz = 6 + Math.random() * 6;
      d.style.width = sz + 'px'; d.style.height = sz * (0.6 + Math.random() * 0.6) + 'px';
      d.style.background = cols[i % cols.length];
      d.style.left = x + 'px'; d.style.top = y + 'px';
      $('#fx').appendChild(d);
      const side = i % 2 ? 1 : -1;                        // 좌우로 번갈아
      const dx = side * (18 + Math.random() * 34), up = 14 + Math.random() * 26;
      anim(d, [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.6}px,${-up}px) rotate(${side * 180}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px,${up * 0.8}px) rotate(${side * 380}deg)`, opacity: 0 },
      ], 420 + Math.random() * 180, { easing: 'cubic-bezier(.2,.6,.5,1)' }).then(() => d.remove());
    }
  }
  // 맞는 순간 번쩍 (광물은 반짝이는 별, 흙·돌은 먼지)
  function impact(x, y, type) {
    const shiny = ['gold', 'diamond', 'obsidian', 'mystery', 'ruby'].includes(type);
    const d = document.createElement('div');
    d.className = shiny ? 'spark' : 'dust';
    d.style.left = x + 'px'; d.style.top = y + 'px';
    $('#fx').appendChild(d);
    anim(d, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 0 }], shiny ? 220 : 320)
      .then(() => d.remove());
  }

  // ---------- 슬롯 릴 ----------
  const REEL_ITEMS = ['pick1', 'pick2', 'pick3', 'pick5', 'pick7', 'spin', 'book', 'tnt', null, null, null, null];
  async function spinReels(grid) {
    const slot = $('#slot');
    const reels = [];
    const N = 18; // 지나가는 칸 수 (열마다 조금씩 늘어나서 늦게 멈춤)
    for (let c = 0; c < C.COLS; c++) {
      const count = N + c * 4;
      // 띠 구성(위→아래): [최종 3칸] + [무작위 칸들] + [이전 화면 3칸 자리]
      const cells = [grid[0][c], grid[1][c], grid[2][c]];
      for (let i = 0; i < count; i++) cells.push(REEL_ITEMS[Math.floor(Math.random() * REEL_ITEMS.length)]);
      const win = document.createElement('div');
      win.className = 'reel';
      win.style.left = c * CELL + 'px';
      const strip = document.createElement('div');
      strip.className = 'reel-strip';
      strip.innerHTML = cells.map(t => `<div class="reel-cell">${t ? Art.item(t) : ''}</div>`).join('');
      win.appendChild(strip);
      slot.appendChild(win);
      const from = -(cells.length - 3) * CELL;
      const dur = 520 + c * 150;
      // 빠르게 내려오다가 마지막에 살짝 넘쳤다 되돌아오며 멈춤
      strip.animate([
        { transform: `translateY(${from}px)`, filter: 'blur(0px)' },
        { transform: `translateY(${from * 0.15}px)`, filter: 'blur(2.5px)', offset: 0.7 },
        { transform: 'translateY(9px)', filter: 'blur(0px)', offset: 0.9 },
        { transform: 'translateY(0px)', filter: 'blur(0px)' },
      ], { duration: dur / (state.skipping ? 12 : state.speed), easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
      reels.push({ win, c, dur });
    }
    // 릴 소리: 도는 동안 틱틱, 열이 멈출 때마다 탁
    const t0 = performance.now();
    let stopped = 0;
    await new Promise(res => {
      const tick = () => {
        const el = (performance.now() - t0) * (state.skipping ? 12 : state.speed);
        while (stopped < reels.length && el >= reels[stopped].dur) { Sound.play('stop'); stopped++; }
        if (stopped >= reels.length) return res();
        Sound.play('reel');
        setTimeout(tick, 55);
      };
      tick();
    });
    // 멈춘 릴을 실제 슬롯 칸으로 교체
    for (const { win, c } of reels) {
      win.remove();
      for (let r = 0; r < C.SLOT_ROWS; r++) setSlotItem(r, c, grid[r][c]);
    }
  }

  // ---------- 보물상자 오픈 연출 (등급별) ----------
  // tier: 0 = 일반(2~4배), 1 = 레어(5~6), 2 = 에픽(7~8), 3 = 전설(9), 4 = 무지개(10배 확정)
  const chestTier = min => min >= 10 ? 4 : min >= 9 ? 3 : min >= 7 ? 2 : min >= 5 ? 1 : 0;
  const TIER_COLOR = ['#fff6c0', '#ffe14a', '#ff9a3c', '#ffd700', 'rainbow'];
  function burst(x, y, n, colors, spread = 120, size = 9, dur = 1100, shape = 'square') {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'confetti ' + shape;
      p.style.background = colors[i % colors.length];
      p.style.width = p.style.height = (size * (0.6 + Math.random() * 0.8)) + 'px';
      p.style.left = x + 'px'; p.style.top = y + 'px';
      $('#fx').appendChild(p);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4, v = spread * (0.5 + Math.random());
      const dx = Math.cos(a) * v, dy = Math.sin(a) * v;
      anim(p, [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${360 * Math.random()}deg)`, opacity: 1, offset: .45 },
        { transform: `translate(${dx * 1.3}px,${dy + 160}px) rotate(${720 * Math.random()}deg)`, opacity: 0 },
      ], dur * (0.8 + Math.random() * 0.5), { easing: 'cubic-bezier(.2,.7,.4,1)' }).then(() => p.remove());
    }
  }
  function flash(color = '#fff', ms = 400) {
    const f = document.createElement('div');
    f.className = 'flash';
    f.style.background = color === 'rainbow' ? 'conic-gradient(#ff5e7e,#ffd84a,#6be38f,#5ab0ff,#c084fc,#ff5e7e)' : color;
    $('#app').appendChild(f);
    anim(f, [{ opacity: .85 }, { opacity: 0 }], ms).then(() => f.remove());
  }
  function rays(x, y, rainbow, ms) {
    const r = document.createElement('div');
    r.className = 'rays' + (rainbow ? ' rainbow' : '');
    r.style.left = x + 'px'; r.style.top = y + 'px';
    $('#fx').appendChild(r);
    anim(r, [{ transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(60deg)', opacity: 1, offset: .2 },
      { transform: 'translate(-50%,-50%) scale(1.1) rotate(160deg)', opacity: 1, offset: .8 }, { transform: 'translate(-50%,-50%) scale(1.3) rotate(200deg)', opacity: 0 }], ms, { easing: 'linear' })
      .then(() => r.remove());
  }
  function stamp(html, cls) {
    const d = document.createElement('div');
    d.className = 'stamp ' + cls;
    d.innerHTML = html;
    $('#stage').appendChild(d);
    anim(d, [{ transform: 'translate(-50%,-50%) scale(3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(.9)', opacity: 1, offset: .18 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .8 }, { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 0 }], 1700).then(() => d.remove());
  }
  async function openChest(ev, sim) {
    const el = chestEls[ev.c];
    const min = sim.chests[ev.c].min, tier = chestTier(min);
    const conf = C.CHESTS.find(x => x.min === min);
    const cx = ev.c * CELL + CELL / 2, cy = BOARD_TOP + C.ROWS * CELL + 30; // 상자 위치 (stage 좌표)
    const stage = $('#stage');
    // 1) 두근두근: 좋은 상자일수록 오래, 세게 흔들림
    el.classList.add('glow', 'tier' + tier);
    Sound.play(tier >= 2 ? 'drumroll' : 'chest');
    const shakes = [2, 3, 5, 7, 9][tier];
    for (let i = 0; i < shakes; i++) {
      const amp = 3 + i * (tier + 1) * 0.6;
      await anim(el, [{ transform: 'scale(1.25) rotate(0deg)' }, { transform: `scale(1.3) rotate(${-amp}deg)` }, { transform: `scale(1.3) rotate(${amp}deg)` }, { transform: 'scale(1.25) rotate(0deg)' }], 200 - i * 8, { fill: 'none' });
    }
    if (tier >= 3) { $('#app').classList.add('dim'); await wait(250); }
    // 2) 오픈
    el.innerHTML = Art.chest(conf, true) + `<span class="mult t${tier}">×${ev.mult}</span>`;
    anim(el, [{ transform: 'scale(1.6)' }, { transform: 'scale(1.25)' }], 300);
    Sound.play(tier >= 1 ? 'chestBig' : 'chest');
    const beam = document.createElement('div');
    beam.className = 'beam t' + tier;
    beam.style.left = cx + 'px';
    $('#fx').appendChild(beam);
    anim(beam, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 0 }], 1400 + tier * 500).then(() => beam.remove());
    const gold = ['#ffd84a', '#fff3a0', '#f5a800'], rainbow = ['#ff5e7e', '#ffd84a', '#6be38f', '#5ab0ff', '#c084fc'];
    if (tier === 0) burst(cx, cy - 10, 10, gold, 70, 6, 800);
    if (tier >= 1) burst(cx, cy - 10, 20 + tier * 12, tier === 4 ? rainbow : gold, 120 + tier * 40, 8, 1300, 'coin');
    if (tier >= 2) { flash(TIER_COLOR[tier], 350 + tier * 80); shake(stage, 6 + tier * 2); }
    if (tier >= 3) rays(cx, cy - 20, tier === 4, 2600);
    if (tier === 4) {
      burst(140, -10, 60, rainbow, 260, 10, 2200);
      stamp('<b>×10</b><small>확정!!</small>', 'rainbow');
      Sound.play('fanfare');
    } else if (tier === 3) stamp(`<b>×${ev.mult}</b>`, 'gold');
    // 3) 점수 반영
    const big = floatText(cx, BOARD_TOP + CELL * 3, `×${ev.mult}`, 'chestmult t' + tier, 2400 + tier * 550);
    await wait(500 + tier * 250);
    big.textContent = `${fmt(ev.before)} → ${fmt(ev.score)}`;
    setScore(ev.score, 700 + tier * 200);
    await wait(900 + tier * 300);
    $('#app').classList.remove('dim');
    el.classList.remove('glow');
    anim(el, [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], 300);
  }

  // ---------- 재생 ----------
  async function replay(sim) {
    let pickEl = null, inExplosion = false;
    const board = sim.board.map(row => row.map(b => ({ ...b })));
    shownScore = 0; setScore(0, 1);

    for (const ev of sim.events) {
      switch (ev.type) {
        case 'init': {
          clearSlot();
          const cells = [];
          for (let r = 0; r < C.SLOT_ROWS; r++) for (let c = 0; c < C.COLS; c++) cells.push([r, c]);
          cells.sort(() => Math.random() - 0.5);
          setSpins(0);
          await wait(300);
          for (let i = 0; i < ev.spins; i++) {
            const [r, c] = cells[i];
            setSlotItem(r, c, 'spin', 'pop');
            Sound.play('spinUp');
            setSpins(i + 1);
            await wait(260);
          }
          await wait(450);
          clearSlot();
          break;
        }
        case 'spin': {
          if (ev.last) { Sound.play('last'); await banner('LAST', 'last'); }
          setSpins(ev.spinsLeft);
          // 릴 회전 연출: 열마다 아이템 띠가 위→아래로 빠르게 지나가다가 왼쪽 열부터 차례로 멈춤
          clearSlot();
          await spinReels(ev.grid);
          await wait(250);
          break;
        }
        case 'spinPlus': {
          const cell = slotEls[ev.r][ev.c].firstChild;
          if (cell) await anim(cell, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 1, offset: .4 }, { transform: 'scale(.2) translateY(-40px)', opacity: 0 }], 420);
          setSlotItem(ev.r, ev.c, null);
          Sound.play('spinUp');
          setSpins(ev.spinsLeft);
          floatText(ev.c * CELL + CELL / 2, ev.r * CELL + 10, '+1 탐지', 'spin');
          break;
        }
        case 'book': {
          const el = slotEls[ev.r][ev.c].firstChild;
          Sound.play('book');
          if (el) await anim(el, [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.35)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'brightness(1)', opacity: 0 }], 500);
          setSlotItem(ev.r, ev.c, null);
          for (const u of ev.ups) { setSlotItem(u.r, u.c, u.to, 'upgrade'); }
          await wait(350);
          break;
        }
        case 'pick': {
          setSlotItem(ev.sr, ev.c, null);
          pickEl = document.createElement('div');
          pickEl.className = 'flypick';
          pickEl.innerHTML = Art.item(ev.item) + `<span class="badge">${ev.power}</span>`;
          const p = pos(ev.sr, ev.c, false);
          pickEl.style.transform = `translate(${p.x}px,${p.y}px)`;
          $('#fx').appendChild(pickEl);
          await wait(80);
          break;
        }
        case 'swing': {
          // 공처럼 자연스럽게: 지금 위치(슬롯 칸 또는 튕겨 오른 꼭대기)에서 중력처럼 떨어져 블록을 치고,
          // 반동으로 위로 튕겨 올랐다가 다음 타격 때 다시 떨어짐
          inExplosion = false;
          if (!pickEl) break;
          const p = pos(ev.r, ev.c, true);
          const tx = p.x + 6, ty = p.y - CELL * 0.6;              // 블록에 닿는 위치
          const h = 115 + Math.min(4, pickEl._hits || 0) * 20;   // 튕겨 오르는 높이 (115 → 최대 195px)
          if (pickEl._up) await pickEl._up;                   // 앞에서 튕겨 오르는 중이면 꼭대기까지 다 올라간 뒤에 떨어짐
          pickEl._hits = (pickEl._hits || 0) + 1;
          pickEl.querySelector('.badge').textContent = ev.power;
          const from = getComputedStyle(pickEl).transform;
          pickEl.getAnimations().forEach(a => a.cancel());
          const m = new DOMMatrix(from === 'none' ? undefined : from);
          const dist = Math.max(30, ty - m.f);                    // 떨어지는 거리
          const fallMs = 170 * Math.sqrt(dist / 150);              // 높이 떨어질수록 오래 (중력 느낌)
          const at = (x, y, r) => `translate(${x}px,${y}px) rotate(${r}deg)`;
          // 떨어지기: 점점 빨라짐, 날이 아래로 기울며 꽂힘
          await anim(pickEl, [{ transform: from === 'none' ? at(tx, ty - h, -15) : from }, { transform: at(tx, ty, 18) }], fallMs,
            { easing: 'cubic-bezier(.45,0,.9,.55)' });
          // 튕겨 오르기: 처음엔 빠르고 꼭대기에서 느려짐
          const upMs = 170 * Math.sqrt(h / 150) * 1.15;
          pickEl._up = anim(pickEl, [{ transform: at(tx, ty, 18) }, { transform: at(tx - 4, ty - h, -15) }], upMs, { easing: 'cubic-bezier(.15,.6,.4,1)' });
          pickEl.style.transform = at(tx - 4, ty - h, -15);
          break;
        }
        case 'hit': {
          const el = blockEls[ev.r][ev.c];
          if (!el) break;
          const ratio = 1 - ev.hp / ev.maxHp;
          el.querySelector('img').src = Art.blockSrc(el.dataset.type, ratio);
          shake(el, inExplosion ? 3 : 5);
          if (!inExplosion) {
            Sound.play('hit', { type: el.dataset.type, ratio });
            const p = pos(ev.r, ev.c, true);
            debris(p.x + CELL / 2, p.y + 8, el.dataset.type, ev.hp === 0 ? 14 : 9);
            impact(p.x + CELL / 2, p.y + 6, el.dataset.type);
          }
          await wait(inExplosion ? 30 : 70);
          break;
        }
        case 'break': {
          const el = blockEls[ev.r][ev.c];
          blockEls[ev.r][ev.c] = null;
          board[ev.r][ev.c] = null;
          const p = pos(ev.r, ev.c, true), cx = p.x + CELL / 2, cy = p.y + CELL / 2;
          if (el) anim(el, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.15)', opacity: .8, offset: .3 }, { transform: 'scale(.4)', opacity: 0 }], 260).then(() => el.remove());
          particles(cx, cy, BLOCK_COLOR[ev.block], ev.block === 'obsidian' || ev.block === 'diamond' ? 14 : 8);
          Sound.play('break', { type: ev.block });
          if (ev.gain >= bet * 0.2) Sound.play('big');
          if (ev.gain > 0) {
            if (ev.gm > 1) {
              const t = floatText(cx, cy - 18, `${fmt(ev.base)} ×${fmt(ev.gm)}`, 'mult');
              wait(380).then(() => { t.textContent = fmt(ev.gain); });
            } else floatText(cx, cy - 18, fmt(ev.gain), ev.block === 'mystery' ? 'mystery' : (ev.gain >= bet * 0.2 ? 'big' : ''));
          }
          setScore(ev.score);
          await wait(ev.gain >= bet * 0.2 ? 320 : 140);
          break;
        }
        case 'tnt': {
          setSlotItem(ev.sr, ev.c, null);
          const t = document.createElement('div');
          t.className = 'flypick';
          t.innerHTML = Art.item('tnt');
          $('#fx').appendChild(t);
          const p0 = pos(ev.sr, ev.c, false), p1 = ev.tr >= 0 ? pos(ev.tr, ev.c, true) : pos(C.ROWS - 1, ev.c, true);
          await anim(t, [{ transform: `translate(${p0.x}px,${p0.y}px)` }, { transform: `translate(${p1.x}px,${p1.y - 8}px) rotate(200deg)` }], 380, { easing: 'ease-in' });
          t.remove();
          if (ev.tr < 0) { floatText(p1.x + CELL / 2, p1.y, '불발', ''); await wait(200); }
          break;
        }
        case 'explode': {
          inExplosion = true;
          const p = pos(ev.r, ev.c, true);
          const b = document.createElement('div');
          b.className = 'boom';
          b.style.left = (p.x + CELL / 2) + 'px'; b.style.top = (p.y + CELL / 2) + 'px';
          $('#fx').appendChild(b);
          anim(b, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: .9, offset: .4 }, { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 0 }], 500).then(() => b.remove());
          Sound.play('boom');
          shake($('#stage'), 6);
          await wait(220);
          break;
        }
        case 'pickEnd': {
          if (pickEl) { const el = pickEl; pickEl = null; anim(el, [{ opacity: 1 }, { opacity: 0 }], 200).then(() => el.remove()); }
          await wait(90);
          break;
        }
        case 'chest': {
          await openChest(ev, sim);
          break;
        }
        case 'spinEnd': clearSlot(); await wait(260); break;
        case 'end': setScore(ev.score, 200); await wait(500); break;
      }
    }
  }

  root.Render = {
    CELL, BOARD_TOP, state, fmt, wait,
    init() { buildSlot(); Art.preload(); },
    drawBoard, setBet, setScore, setSpins, setGauge, clearSlot, replay, banner,
    gaugeFrac,
  };
})(window);

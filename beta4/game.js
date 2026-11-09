// 곡괭이 키우기 — 심층 광맥 · 1단계: "부수는 손맛" + 공격 방식 비교 (docs/deep-vein.md)
(() => {
  const W = 720;
  const BOX = document.getElementById('game').getBoundingClientRect();
  const H = Math.max(1000, Math.round(W * BOX.height / Math.max(1, BOX.width)));
  const OY = Math.round((H - 1000) * 0.45);   // 내용(1000 기준)을 아래로 옮기는 양
  const FONT = '"Black Han Sans", sans-serif';

  // ---------- 공격 방식 ----------
  const STYLES = {
    basic: { name: '기본', desc: '<b>기본</b> · 평범한 한 방', picks: [{ tex: 'pick4', scale: 0.82 }], every: 0.8, wind: 0.22, dmg: 20 },
    twin: { name: '쌍곡괭이', desc: '<b>쌍곡괭이</b> · 두 개가 번갈아 빠르게 · 12타마다 <b>균열 폭발</b> · 철갑에 약함',
      picks: [{ tex: 'pick1', scale: 0.7 }, { tex: 'pick1', scale: 0.7 }], every: 0.3, wind: 0.1, dmg: 7, combo: 12, comboDmg: 50 },
    heavy: { name: '대곡괭이', desc: '<b>대곡괭이</b> · 크게 들어 올려 내려찍기 · <b>충격파</b>가 옆 광석도 때림 · 느림',
      picks: [{ tex: 'pick8', scale: 1.08 }], every: 1.6, wind: 0.7, dmg: 55, wave: 0.45 },
    shard: { name: '파편', desc: '<b>파편 곡괭이</b> · 칠 때마다 <b>파편 3개</b>가 다른 광석으로 · 여러 개 처리에 강함',
      picks: [{ tex: 'pick4', scale: 0.82 }], every: 0.85, wind: 0.22, dmg: 14, shards: 3, shardDmg: 8 },
  };
  // ---------- 광맥 ----------
  const VEINS = {
    normal: { name: '일반', main: { tex: 'main', hp: 160, armor: 0, ore: 12 }, side: { tex: 'soft', hp: 40, armor: 0, ore: 3 }, respawn: 2.5 },
    swarm: { name: '무른 무리', main: { tex: 'main', hp: 160, armor: 0, ore: 10 }, side: { tex: 'soft', hp: 16, armor: 0, ore: 2 }, respawn: 0.8 },
    armor: { name: '철갑', main: { tex: 'armor', hp: 170, armor: 10, ore: 16 }, side: { tex: 'armor', hp: 50, armor: 10, ore: 4 }, respawn: 3 },
  };
  const COLOR = { main: 0x8d8a86, soft: 0xc0702c, armor: 0x5d636c, reso: 0x3cc7c0, guardian: 0x8a6aa8, cursed: 0x6b4a8a };
  const POS = { main: { x: 360, y: 500 + OY, size: 330 }, L: { x: 132, y: 790 + OY, size: 170 }, R: { x: 588, y: 790 + OY, size: 170 } };

  let style = 'basic', vein = 'normal', muted = false;

  // ---------- 효과음 (합성) ----------
  let AC = null;
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; };
  function noise(dur, freq, vol, type = 'lowpass') {
    const a = ac(); if (!a || muted) return;
    const n = a.createBufferSource(), b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    n.buffer = b; const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol; n.connect(f); f.connect(g); g.connect(a.destination); n.start();
  }
  function tone(f0, f1, dur, vol, type = 'sine') {
    const a = ac(); if (!a || muted) return;
    const o = a.createOscillator(), g = a.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, a.currentTime); o.frequency.exponentialRampToValueAtTime(f1, a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  const SFX = {
    hit: k => { noise(0.07, 1800 + 800 * k, 0.35 + 0.25 * k); tone(170 - 40 * k, 60, 0.12 + 0.08 * k, 0.4 + 0.3 * k); },
    clink: () => { tone(1800, 1200, 0.06, 0.08, 'triangle'); },
    armor: () => { tone(900, 700, 0.09, 0.12, 'square'); noise(0.05, 4000, 0.2, 'highpass'); },
    brk: big => { noise(big ? 0.45 : 0.25, 900, big ? 0.7 : 0.45); tone(big ? 110 : 160, 40, big ? 0.4 : 0.2, 0.6); setTimeout(() => tone(1500, 2400, 0.12, 0.08, 'triangle'), 80); },
    boom: () => { noise(0.35, 600, 0.6); tone(90, 30, 0.35, 0.7); },
    coin: () => tone(1300 + Math.random() * 300, 2000, 0.05, 0.05, 'triangle'),
  };

  // ---------- 장면 ----------
  class Mine extends Phaser.Scene {
    preload() {
      for (const t of ['main', 'soft', 'armor']) this.load.image(t, `img/${t}.png`);
      for (const t of ['pick1', 'pick4', 'pick8']) this.load.image(t, `img/${t}.webp`);
    }
    create() {
      this.makeTextures();
      this.drawBackground();
      this.ores = {}; this.picks = []; this.ore = 0; this.target = 'main';
      this.dmgLog = []; this.ttk = []; this.comboN = 0; this.freezeUntil = 0;
      this.marker = this.add.ellipse(0, 0, 10, 10).setStrokeStyle(4, 0xffd54a, 0.9).setDepth(1).setVisible(false);
      this.chips = {};
      this.nug = this.add.particles(0, 0, 'nug', { emitting: false, speed: { min: 180, max: 380 }, angle: { min: 200, max: 340 }, gravityY: 1100, lifespan: 900, scale: { start: 1, end: 0.6 }, rotate: { min: 0, max: 360 } }).setDepth(6);
      this.hud = this.add.text(28, 26, '', { fontFamily: FONT, fontSize: '40px', color: '#ffd54a', stroke: '#2a1a00', strokeThickness: 8 }).setDepth(10);
      this.hudIcon = this.add.image(0, 0, 'nug').setScale(2.2).setDepth(10);
      this.hint = this.add.text(W / 2, 92 + OY * 0.3, '광석을 누르면 그걸 먼저 캐요', { fontFamily: 'sans-serif', fontSize: '22px', color: '#a39cb8' }).setOrigin(0.5).setDepth(10);
      this.setOreCount(0);
      this.input.on('pointerdown', () => ac());
      this.setVein(vein); this.setStyle(style);
      this.nextSwing = 0.6;
      window.__deep = { scene: this, setStyle: s => this.setStyle(s), setVein: v => this.setVein(v) };
    }

    // 코드로 만드는 작은 그림들
    makeTextures() {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff); g.fillPoints([{ x: 4, y: 0 }, { x: 14, y: 3 }, { x: 16, y: 12 }, { x: 7, y: 16 }, { x: 0, y: 9 }], true); g.generateTexture('chip', 16, 16); g.clear();
      g.fillStyle(0xffd54a); g.fillPoints([{ x: 6, y: 0 }, { x: 12, y: 5 }, { x: 10, y: 12 }, { x: 2, y: 12 }, { x: 0, y: 5 }], true);
      g.fillStyle(0xfff3b0); g.fillPoints([{ x: 6, y: 1 }, { x: 9, y: 4 }, { x: 5, y: 6 }], true); g.generateTexture('nug', 12, 12); g.clear();
      g.fillStyle(0xffffff); g.fillCircle(32, 32, 32); g.generateTexture('flash', 64, 64); g.clear();
      g.fillStyle(0x9ff7ff); g.fillPoints([{ x: 8, y: 0 }, { x: 16, y: 10 }, { x: 8, y: 26 }, { x: 0, y: 10 }], true);
      g.fillStyle(0xffffff); g.fillPoints([{ x: 8, y: 2 }, { x: 11, y: 10 }, { x: 8, y: 14 }], true); g.generateTexture('shard', 16, 26); g.clear();
      g.fillStyle(0xffffff, 0.5); g.fillCircle(4, 4, 4); g.generateTexture('dust', 8, 8); g.destroy();
      const cv = this.textures.createCanvas('glow', 64, 64), cx = cv.getContext(), rg = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = rg; cx.fillRect(0, 0, 64, 64); cv.refresh();
    }
    drawBackground() {
      const g = this.add.graphics().setDepth(-10);
      for (let i = 0; i < 40; i++) { const t = i / 39; g.fillStyle(Phaser.Display.Color.GetColor(20 + 22 * t, 16 + 14 * t, 30 + 16 * t)); g.fillRect(0, H * t, W, H / 39 + 1); }
      // 동굴 벽 실루엣
      g.fillStyle(0x0d0a14, 1);
      g.fillPoints([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 70, y: 180 + OY }, { x: 95, y: 360 + OY }, { x: 40, y: 560 + OY }, { x: 0, y: 620 + OY }], true);
      g.fillPoints([{ x: W, y: 0 }, { x: 590, y: 0 }, { x: 650, y: 200 + OY }, { x: 615, y: 380 + OY }, { x: 680, y: 560 + OY }, { x: W, y: 640 + OY }], true);
      // 바닥
      const fy = 845 + OY;
      g.fillStyle(0x241c33, 1); g.fillPoints([{ x: 0, y: fy + 25 }, { x: 180, y: fy }, { x: 360, y: fy + 15 }, { x: 540, y: fy - 3 }, { x: W, y: fy + 23 }, { x: W, y: H }, { x: 0, y: H }], true);
      g.fillStyle(0x2f2542, 1); g.fillPoints([{ x: 0, y: fy + 25 }, { x: 180, y: fy }, { x: 360, y: fy + 15 }, { x: 540, y: fy - 3 }, { x: W, y: fy + 23 }, { x: W, y: fy + 39 }, { x: 0, y: fy + 41 }], true);
      // 은은한 빛
      const glow = this.add.image(W / 2, 520 + OY, 'glow').setScale(12).setAlpha(0.22).setTint(0xffc860).setDepth(-9);
      this.tweens.add({ targets: glow, alpha: 0.1, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.add.particles(0, 0, 'dust', { x: { min: 0, max: W }, y: { min: 100, max: H - 100 }, lifespan: 6000, speedY: { min: -12, max: -4 }, speedX: { min: -6, max: 6 }, alpha: { start: 0.45, end: 0 }, scale: { min: 0.4, max: 1 }, frequency: 260 }).setDepth(-8);
    }

    // ---------- 광맥·광석 ----------
    setVein(v) {
      vein = v;
      for (const k in this.ores) this.killOre(k, true);
      this.ttk = []; this.mainStart = this.time.now;
      this.spawn('main'); this.spawn('L'); this.spawn('R');
      updateUI();
    }
    spawn(slot) {
      const V = VEINS[vein], d = slot === 'main' ? V.main : V.side, p = POS[slot];
      const img = this.add.image(p.x, p.y, d.tex).setDepth(2).setInteractive({ useHandCursor: true });
      const s = p.size / 256; img.setScale(0);
      this.tweens.add({ targets: img, scale: s, duration: 380, ease: 'Back.Out' });
      img.on('pointerdown', () => { this.target = slot; this.showMarker(); });
      const shadow = this.add.ellipse(p.x, p.y + p.size * 0.44, p.size * 0.8, p.size * 0.16, 0x000000, 0.35).setDepth(1);
      const cracks = this.add.graphics().setDepth(3).setPosition(p.x, p.y);
      const bar = this.add.graphics().setDepth(4);
      const o = { slot, d, img, s, shadow, cracks, bar, hp: d.hp, max: d.hp, alive: true, crackLv: 0, born: this.time.now };
      this.ores[slot] = o;
      if (slot === 'main') this.mainStart = this.time.now;
      this.drawBar(o);
      return o;
    }
    killOre(slot, silent) {
      const o = this.ores[slot]; if (!o) return;
      o.alive = false; delete this.ores[slot];
      [o.img, o.shadow, o.cracks, o.bar].forEach(x => x.destroy());
      if (silent) return;
    }
    drawBar(o) {
      const p = POS[o.slot], w = o.slot === 'main' ? 240 : 120, y = p.y - p.size * 0.56;
      o.bar.clear();
      o.bar.fillStyle(0x000000, 0.55); o.bar.fillRoundedRect(p.x - w / 2 - 3, y - 3, w + 6, 16, 8);
      o.bar.fillStyle(o.d.armor ? 0x9db3c8 : 0x5be37d, 1); o.bar.fillRoundedRect(p.x - w / 2, y, Math.max(0, w * o.hp / o.max), 10, 5);
    }
    showMarker() {
      const o = this.ores[this.target]; if (!o) { this.marker.setVisible(false); return; }
      const p = POS[o.slot];
      this.marker.setPosition(p.x, p.y + p.size * 0.44).setSize(p.size * 0.95, p.size * 0.22).setVisible(true);
      this.marker.setStrokeStyle(4, 0xffd54a, 0.9);
    }
    aliveTarget() {
      if (this.ores[this.target]?.alive) return this.ores[this.target];
      this.target = 'main'; return this.ores.main?.alive ? this.ores.main : null;
    }

    // ---------- 곡괭이 ----------
    setStyle(s) {
      style = s; this.picks.forEach(p => p.img.destroy()); this.picks = [];
      STYLES[s].picks.forEach((pk, i) => {
        const img = this.add.image(0, 0, pk.tex).setDepth(5);
        this.picks.push({ img, scale: pk.scale, side: i === 0 ? 1 : -1, busy: false });
      });
      this.pickTurn = 0; this.comboN = 0; this.nextSwing = 0.3;
      this.picks.forEach(p => this.restPose(p, this.aliveTarget(), true));
      updateUI();
    }
    // 곡괭이 위치·각도 계산: side 1 = 대상 오른쪽(머리가 왼쪽을 향함), -1 = 왼쪽
    geom(p, o) {
      const P = o ? POS[o.slot] : POS.main;
      let side = p.side; if (this.picks.length === 1) side = P.x > W / 2 + 10 ? -1 : 1;
      const flip = side === 1;
      const dist = P.size * 0.5 + 120 * p.scale;
      const px = P.x + side * dist, py = P.y + 40;
      const tw = p.img.width, th = p.img.height;
      const ox = flip ? 0.88 : 0.12, hx = flip ? 0.4 : 0.6;
      const vx = (hx - ox) * tw, vy = (0.15 - 0.95) * th;
      const aimX = P.x + side * P.size * 0.12, aimY = P.y - P.size * 0.05;
      const strike = Math.atan2(aimY - py, aimX - px) - Math.atan2(vy, vx);
      const reach = Math.hypot(aimX - px, aimY - py) / Math.hypot(vx, vy);
      return { px, py, flip, ox, strike, sc: Math.min(p.scale * 1.15, Math.max(p.scale * 0.8, reach)), side, aimX, aimY };
    }
    restPose(p, o, instant) {
      const g = this.geom(p, o);
      p.img.setFlipX(g.flip).setOrigin(g.ox, 0.95).setScale(g.sc);
      const rot = g.strike - g.side * -0.55;
      if (instant) p.img.setPosition(g.px, g.py).setRotation(rot);
      else this.tweens.add({ targets: p.img, x: g.px, y: g.py, rotation: rot, duration: 220, ease: 'Sine.Out' });
    }
    swing() {
      const S = STYLES[style], o = this.aliveTarget(); if (!o) return;
      const p = this.picks[this.pickTurn % this.picks.length]; this.pickTurn++;
      if (p.busy) return; p.busy = true;
      const g = this.geom(p, o);
      p.img.setFlipX(g.flip).setOrigin(g.ox, 0.95).setScale(g.sc).setPosition(g.px, g.py);
      const up = g.strike + g.side * (style === 'heavy' ? 1.15 : 0.95);
      this.tweens.chain({
        targets: p.img, tweens: [
          { rotation: up, y: g.py - (style === 'heavy' ? 30 : 12), duration: S.wind * 1000, ease: 'Sine.Out' },
          { rotation: g.strike, y: g.py, duration: style === 'heavy' ? 110 : 75, ease: 'Quad.In', onComplete: () => this.impact(o, g, p) },
          { rotation: g.strike - g.side * -0.55, duration: 240, ease: 'Sine.Out', onComplete: () => { p.busy = false; } },
        ],
      });
    }

    // ---------- 타격 ----------
    impact(o, g, p) {
      if (!o.alive) return;
      const S = STYLES[style];
      const k = style === 'heavy' ? 1 : style === 'twin' ? 0.15 : 0.45;
      const hx = g.aimX + Phaser.Math.Between(-18, 18), hy = g.aimY + Phaser.Math.Between(-18, 18);
      this.hitStop(style === 'heavy' ? 110 : style === 'twin' ? 25 : 55);
      this.cameras.main.shake(style === 'heavy' ? 160 : 70, style === 'heavy' ? 0.012 : 0.0035);
      this.damage(o, S.dmg, hx, hy, k, true);
      if (style === 'twin' && ++this.comboN % S.combo === 0) this.time.delayedCall(90, () => this.crackBurst(o));
      if (style === 'heavy') this.shockwave(hx, hy, S);
      if (style === 'shard') this.fireShards(o, hx, hy, S);
    }
    hitStop(ms) {
      this.tweens.timeScale = 0.02;
      clearTimeout(this._hs); this._hs = setTimeout(() => { this.tweens.timeScale = 1; }, ms);
    }
    damage(o, raw, x, y, k, main) {
      if (!o.alive) return;
      const dmg = Math.max(1, raw - o.d.armor), blocked = o.d.armor > 0 && raw <= o.d.armor * 1.6;
      o.hp -= dmg; this.dmgLog.push([this.time.now, dmg]);
      // 번쩍 + 찌그러짐
      o.img.setTintFill(0xffffff); this.time.delayedCall(45, () => o.img.active && o.img.clearTint());
      this.tweens.add({ targets: o.img, scaleX: o.s * (1 + 0.07 * (0.4 + k)), scaleY: o.s * (1 - 0.06 * (0.4 + k)), duration: 50, yoyo: true, ease: 'Quad.Out', onComplete: () => o.img.active && o.img.setScale(o.s) });
      // 섬광
      const f = this.add.image(x, y, 'flash').setDepth(7).setScale(0.3 + 0.5 * k).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD).setTint(blocked ? 0x9fc4ff : 0xfff1c0);
      this.tweens.add({ targets: f, scale: 0.9 + 1.4 * k, alpha: 0, duration: 160, onComplete: () => f.destroy() });
      // 돌 조각
      this.chipFx(o, x, y, Math.round(4 + 10 * k));
      // 숫자
      this.num(x, y - 20, dmg, k, blocked);
      if (main) blocked ? SFX.armor() : SFX.hit(k); else SFX.clink();
      // 균열
      const lv = Math.floor((1 - o.hp / o.max) * 6);
      while (o.crackLv < lv && o.crackLv < 6) { o.crackLv++; this.addCrack(o, x, y); }
      this.drawBar(o);
      if (o.hp <= 0) this.shatter(o);
    }
    chipFx(o, x, y, n) {
      const col = COLOR[o.d.tex] || 0x888888;
      if (!this.chips[col]) this.chips[col] = this.add.particles(0, 0, 'chip', { emitting: false, tint: [col, Phaser.Display.Color.ValueToColor(col).brighten(25).color, 0x3a3440], speed: { min: 160, max: 460 }, angle: { min: 190, max: 350 }, gravityY: 1300, lifespan: 750, scale: { min: 0.5, max: 1.3 }, rotate: { min: 0, max: 360 } }).setDepth(6);
      this.chips[col].explode(n, x, y);
    }
    num(x, y, n, k, blocked) {
      const t = this.add.text(x + Phaser.Math.Between(-20, 20), y, String(Math.round(n)), { fontFamily: FONT, fontSize: `${Math.round(30 + 34 * k)}px`, color: blocked ? '#9fc4ff' : k > 0.8 ? '#ffd54a' : '#ffffff', stroke: '#000000', strokeThickness: 7 }).setOrigin(0.5).setDepth(9);
      this.tweens.add({ targets: t, y: y - 70 - 40 * k, alpha: { from: 1, to: 0 }, scale: { from: 1.3, to: 1 }, duration: 750, ease: 'Cubic.Out', onComplete: () => t.destroy() });
    }
    addCrack(o, x, y) {
      const p = POS[o.slot], r = p.size * 0.36;
      const cx = Phaser.Math.Clamp(x - p.x, -r * 0.5, r * 0.5), cy = Phaser.Math.Clamp(y - p.y, -r * 0.5, r * 0.5);
      const g = o.cracks, n = o.crackLv < 3 ? 1 : 2, glowCol = o.d.tex === 'main' ? 0xffc84a : 0xfff2dc;
      for (let b = 0; b < n; b++) {
        let a = Math.random() * Math.PI * 2, px = cx, py = cy;
        const pts = [[px, py]], seg = r * (0.10 + 0.035 * o.crackLv);
        for (let s = 0; s < 4; s++) { a += Phaser.Math.FloatBetween(-0.7, 0.7); px += Math.cos(a) * seg; py += Math.sin(a) * seg; if (Math.hypot(px, py) > r) break; pts.push([px, py]); }
        const path = (w, col, al, dx, dy) => { g.lineStyle(w, col, al); g.beginPath(); g.moveTo(pts[0][0] + dx, pts[0][1] + dy); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + dx, pts[i][1] + dy); g.strokePath(); };
        path(5, 0x1a1222, 0.55, 0, 0);          // 갈라진 틈(그림자)
        path(2, glowCol, 0.75, 0, 0);           // 틈 속 빛
        path(1.5, 0xffffff, 0.25, 1.5, 2);      // 가장자리 반사
      }
    }
    // 쌍곡괭이: 균열 폭발
    crackBurst(o) {
      if (!o.alive) return;
      const p = POS[o.slot];
      const ring = this.add.circle(p.x, p.y, 20).setStrokeStyle(10, 0xff9a3c, 1).setDepth(7);
      this.tweens.add({ targets: ring, radius: p.size * 0.65, alpha: 0, duration: 380, ease: 'Cubic.Out', onUpdate: () => ring.setStrokeStyle(10 * ring.alpha + 2, 0xff9a3c, ring.alpha), onComplete: () => ring.destroy() });
      this.banner('균열 폭발!', '#ff9a3c');
      this.hitStop(80); this.cameras.main.shake(140, 0.008); SFX.boom();
      this.damage(o, STYLES.twin.comboDmg + o.d.armor, p.x, p.y, 0.9, false);
    }
    // 대곡괭이: 충격파
    shockwave(x, y, S) {
      const ring = this.add.ellipse(x, POS.main.y + 160, 60, 20).setStrokeStyle(8, 0xfff0c0, 0.9).setDepth(1);
      this.tweens.add({ targets: ring, width: 900, height: 140, alpha: 0, duration: 420, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
      for (const k of ['L', 'R', 'main']) {
        const o = this.ores[k]; if (!o || !o.alive || o.slot === this.target) continue;
        this.time.delayedCall(120, () => this.damage(o, S.dmg * S.wave, POS[k].x, POS[k].y, 0.35, false));
      }
    }
    // 파편 곡괭이
    fireShards(from, x, y, S) {
      for (let i = 0; i < S.shards; i++) {
        const cands = Object.values(this.ores).filter(o => o.alive && o !== from);
        const t = cands.length ? Phaser.Utils.Array.GetRandom(cands) : from;
        const P = POS[t.slot], tx = P.x + Phaser.Math.Between(-30, 30), ty = P.y + Phaser.Math.Between(-30, 20);
        const sh = this.add.image(x, y, 'shard').setDepth(8).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD);
        const midX = (x + tx) / 2 + Phaser.Math.Between(-80, 80), midY = Math.min(y, ty) - Phaser.Math.Between(120, 220);
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2(midX, midY), new Phaser.Math.Vector2(tx, ty));
        const st = { t: 0 };
        this.tweens.add({ targets: st, t: 1, duration: 300 + i * 50, delay: i * 40, ease: 'Sine.In',
          onUpdate: () => { const q = curve.getPoint(st.t), q2 = curve.getPoint(Math.min(1, st.t + 0.05)); sh.setPosition(q.x, q.y).setRotation(Math.atan2(q2.y - q.y, q2.x - q.x) + Math.PI / 2); },
          onComplete: () => { sh.destroy(); if (t.alive) this.damage(t, S.shardDmg, tx, ty, 0.12, false); } });
      }
    }
    // ---------- 깨짐 ----------
    shatter(o) {
      const p = POS[o.slot], big = o.slot === 'main';
      o.alive = false;
      if (big) { this.ttk.push((this.time.now - this.mainStart) / 1000); updateUI(); }
      // 4조각
      const tex = o.d.tex, hw = 128;
      [[0, 0, -1, -1], [hw, 0, 1, -1], [0, hw, -1, 1], [hw, hw, 1, 1]].forEach(([cx, cy, dx, dy]) => {
        const piece = this.add.image(p.x, p.y, tex).setScale(o.s).setCrop(cx, cy, hw, hw).setDepth(6);
        this.tweens.add({ targets: piece, x: p.x + dx * Phaser.Math.Between(90, 170) * (big ? 1.3 : 0.8), y: p.y + dy * 40 + Phaser.Math.Between(40, 160), angle: dx * Phaser.Math.Between(25, 70), alpha: 0, duration: 650, ease: 'Cubic.Out', onComplete: () => piece.destroy() });
      });
      const f = this.add.image(p.x, p.y, 'flash').setDepth(7).setScale(1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a8);
      this.tweens.add({ targets: f, scale: big ? 7 : 3.5, alpha: 0, duration: 300, onComplete: () => f.destroy() });
      this.chipFx(o, p.x, p.y, big ? 40 : 16);
      this.hitStop(big ? 140 : 60); this.cameras.main.shake(big ? 260 : 120, big ? 0.016 : 0.007);
      if (big) this.cameras.main.flash(120, 255, 240, 200);
      SFX.brk(big);
      // 광석 획득
      const n = o.d.ore;
      this.nug.explode(Math.min(24, n * 2), p.x, p.y);
      for (let i = 0; i < Math.min(n, 12); i++) {
        const c = this.add.image(p.x + Phaser.Math.Between(-40, 40), p.y + Phaser.Math.Between(-30, 30), 'nug').setScale(2).setDepth(9);
        this.tweens.add({ targets: c, x: this.hudIcon.x, y: this.hudIcon.y, scale: 1.2, delay: 250 + i * 45, duration: 520, ease: 'Cubic.In',
          onComplete: () => { c.destroy(); this.setOreCount(this.ore + n / Math.min(n, 12)); SFX.coin(); } });
      }
      this.banner(big ? `깨짐! +${n} 광석` : `+${n}`, '#ffd54a', big ? 1 : 0.5, big ? null : p);
      [o.img, o.shadow, o.cracks, o.bar].forEach(x => x.destroy());
      delete this.ores[o.slot];
      const V = VEINS[vein];
      this.time.delayedCall(big ? 1100 : V.respawn * 1000, () => { if (!this.ores[o.slot]) { this.spawn(o.slot); this.showMarker(); } });
      if (this.target === o.slot) this.target = 'main';
      this.showMarker();
    }
    banner(text, color, k = 1, at) {
      const x = at ? at.x : W / 2, y = at ? at.y - 120 : 230;
      const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${Math.round(40 + 30 * k)}px`, color, stroke: '#1a0f00', strokeThickness: 10 }).setOrigin(0.5).setDepth(11).setScale(0.5);
      this.tweens.chain({ targets: t, tweens: [{ scale: 1.1, duration: 140, ease: 'Back.Out' }, { scale: 1, duration: 80 }, { alpha: 0, y: y - 40, delay: 500, duration: 350, onComplete: () => t.destroy() }] });
    }
    setOreCount(v) {
      this.ore = v; this.hud.setText(String(Math.floor(v)));
      this.hudIcon.setPosition(this.hud.x + this.hud.width + 26, this.hud.y + 26);
    }

    update(time, delta) {
      const dt = Math.min(0.05, delta / 1000) * this.tweens.timeScale;
      this.nextSwing -= dt;
      if (this.nextSwing <= 0) {
        const S = STYLES[style];
        this.nextSwing += S.every;
        this.swing();
      }
      // 초당 피해(최근 4초)
      if (!this._dpsT || time - this._dpsT > 400) {
        this._dpsT = time; this.dmgLog = this.dmgLog.filter(d => time - d[0] < 4000);
        const s = this.dmgLog.reduce((a, d) => a + d[1], 0) / 4;
        document.getElementById('dps').textContent = Math.round(s);
      }
    }
  }

  // ---------- 아래 버튼 ----------
  const sc = () => game.scene.keys.mine;
  function updateUI() {
    document.querySelectorAll('#styles button').forEach(b => b.classList.toggle('on', b.dataset.k === style));
    document.querySelectorAll('#veins button').forEach(b => b.classList.toggle('on', b.dataset.k === vein));
    document.getElementById('desc').innerHTML = STYLES[style].desc;
    const s = sc(); const t = s && s.ttk && s.ttk.length ? (s.ttk.reduce((a, b) => a + b, 0) / s.ttk.length).toFixed(1) + '초' : '-';
    document.getElementById('ttk').textContent = t;
  }
  for (const [k, v] of Object.entries(STYLES)) {
    const b = document.createElement('button'); b.textContent = v.name; b.dataset.k = k;
    b.onclick = () => { ac(); sc().setStyle(k); sc().ttk = []; sc().mainStart = sc().time.now; updateUI(); };
    document.getElementById('styles').append(b);
  }
  for (const [k, v] of Object.entries(VEINS)) {
    const b = document.createElement('button'); b.textContent = v.name; b.dataset.k = k;
    b.onclick = () => { ac(); sc().setVein(k); sc().setStyle(style); };
    document.getElementById('veins').append(b);
  }
  document.getElementById('mute').onclick = e => { muted = !muted; e.target.textContent = muted ? '🔇' : '🔊'; };

  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#14111c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY, width: W, height: H },
    scene: [], render: { antialias: true },
  });
  game.scene.add('mine', Mine, true);
})();

// =====================================================
//  그림 — 이미지 파일 없이 SVG 문자열로 직접 그립니다
// =====================================================
(function (root) {
  let uid = 0;
  const id = p => p + (++uid);
  const svg = (inner, vb = '0 0 100 100') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

  // ---------- 블록 ----------
  function stoneBase(fill = '#7f838c', dark = '#5b5f68', light = '#a3a7b0') {
    return `<rect x="2" y="2" width="96" height="96" rx="9" fill="${fill}" stroke="#2c2e33" stroke-width="4"/>
      <path d="M8 34 L40 30 L52 8 M40 30 L46 60 L10 66 M46 60 L92 54 M70 56 L74 92 M52 8" stroke="${dark}" stroke-width="3" fill="none"/>
      <path d="M12 12 L36 10 M60 14 L88 12 M14 72 L30 70 M54 66 L66 64" stroke="${light}" stroke-width="3" stroke-linecap="round"/>`;
  }
  const BLOCK_ART = {
    grass: () => `<rect x="2" y="2" width="96" height="96" rx="9" fill="#b8742f" stroke="#3b2410" stroke-width="4"/>
      <path d="M4 10 Q4 4 10 4 L90 4 Q96 4 96 10 L96 34 L88 40 L80 33 L70 42 L60 34 L50 42 L40 33 L30 42 L20 34 L10 41 L4 35Z" fill="#5fbf3a"/>
      <path d="M8 12 L92 12" stroke="#8be05a" stroke-width="5" stroke-linecap="round"/>
      <g fill="#8c5422"><rect x="18" y="56" width="10" height="8" rx="2"/><rect x="60" y="70" width="12" height="8" rx="2"/><rect x="40" y="82" width="8" height="6" rx="2"/><rect x="76" y="52" width="8" height="6" rx="2"/></g>`,
    dirt: () => `<rect x="2" y="2" width="96" height="96" rx="9" fill="#c27a33" stroke="#3b2410" stroke-width="4"/>
      <path d="M10 10 L90 10" stroke="#dc9a52" stroke-width="5" stroke-linecap="round"/>
      <g fill="#8c5422"><rect x="16" y="24" width="12" height="8" rx="2"/><rect x="58" y="34" width="10" height="8" rx="2"/><rect x="30" y="60" width="12" height="8" rx="2"/><rect x="70" y="72" width="10" height="7" rx="2"/><rect x="44" y="84" width="8" height="6" rx="2"/></g>`,
    stone: () => stoneBase(),
    ruby: () => stoneBase() + `<g fill="#e3193f" stroke="#7a0b20" stroke-width="2.5">
      <path d="M26 22 l9 -9 l9 9 l-9 12z"/><path d="M62 40 l8 -8 l8 8 l-8 11z"/><path d="M22 62 l7 -7 l7 7 l-7 9z"/><path d="M58 72 l9 -9 l9 9 l-9 12z"/></g>
      <g fill="#ff8aa0"><circle cx="32" cy="20" r="2"/><circle cx="67" cy="38" r="2"/><circle cx="63" cy="70" r="2"/></g>`,
    gold: () => `<rect x="2" y="2" width="96" height="96" rx="9" fill="#f2b90f" stroke="#7a5200" stroke-width="4"/>
      <path d="M8 8 L92 8 L80 20 L20 20Z" fill="#ffe36b"/><path d="M92 8 L92 92 L80 80 L80 20Z" fill="#d99a00"/>
      <path d="M8 92 L92 92 L80 80 L20 80Z" fill="#c78800"/><path d="M8 8 L8 92 L20 80 L20 20Z" fill="#ffd23a"/>
      <path d="M30 70 L66 30 M42 74 L72 42" stroke="#fff3b0" stroke-width="5" stroke-linecap="round"/>`,
    diamond: () => `<rect x="2" y="2" width="96" height="96" rx="9" fill="#7fd8f2" stroke="#1d6a86" stroke-width="4"/>
      <path d="M8 8 L50 30 L92 8 M8 92 L50 70 L92 92 M8 8 L30 50 L8 92 M92 8 L70 50 L92 92" stroke="#c9f3ff" stroke-width="3" fill="none"/>
      <path d="M30 50 L50 30 L70 50 L50 70Z" fill="#b5efff"/><path d="M38 44 L50 36" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
    obsidian: () => `<rect x="2" y="2" width="96" height="96" rx="9" fill="#2a1a43" stroke="#100820" stroke-width="4"/>
      <path d="M10 30 L40 22 L60 40 L90 30 M20 70 L46 60 L70 78 L90 66" stroke="#3e2766" stroke-width="4" fill="none"/>
      <g fill="#a46bff"><circle cx="24" cy="44" r="4"/><circle cx="70" cy="22" r="3"/><circle cx="58" cy="60" r="5"/><circle cx="30" cy="84" r="3"/><circle cx="82" cy="84" r="4"/></g>
      <g fill="#e5d0ff"><circle cx="58" cy="58" r="1.6"/><circle cx="23" cy="43" r="1.4"/></g>`,
    explosive: () => `<rect x="2" y="2" width="96" height="96" rx="9" fill="#2f2622" stroke="#140d0a" stroke-width="4"/>
      <path d="M50 50 L30 20 L18 26 M50 50 L78 22 L86 34 M50 50 L22 74 L12 70 M50 50 L74 82 L88 76 M50 50 L50 88" stroke="#ff7a12" stroke-width="5" fill="none" stroke-linejoin="round"/>
      <path d="M50 50 L30 20 M50 50 L78 22 M50 50 L22 74 M50 50 L74 82" stroke="#ffd25c" stroke-width="2" fill="none"/>
      <circle cx="50" cy="50" r="7" fill="#ffb02e"/>`,
    mystery: () => `<rect x="2" y="2" width="96" height="96" rx="9" fill="#e21d4f" stroke="#6b0620" stroke-width="4"/>
      <rect x="10" y="10" width="80" height="80" rx="6" fill="none" stroke="#ff7d9c" stroke-width="3"/>
      <text x="50" y="72" text-anchor="middle" font-size="62" font-weight="900" font-family="Arial Black,Arial" fill="#fff" stroke="#6b0620" stroke-width="3" paint-order="stroke">?</text>`,
  };
  // 블록 이미지 (assets/blocks/*.png, Gemini로 생성). 손상 단계: _d1 ~ _d3
  const STAGED = ['stone', 'ruby', 'gold', 'diamond', 'obsidian', 'explosive', 'mystery'];
  function blockSrc(type, ratio = 0) {
    if (!STAGED.includes(type) || ratio <= 0) return `assets/blocks/${type}.png`;
    const stage = Math.min(3, Math.max(1, Math.ceil(ratio * 3)));
    return `assets/blocks/${type}_d${stage}.png`;
  }
  function block(type) { return `<img class="blockimg" src="${blockSrc(type)}" alt="" draggable="false">`; }
  // 이미지 미리 불러오기 (처음 깨질 때 깜빡임 방지)
  function preload() {
    for (const t of ITEM_TYPES) new Image().src = `assets/items/${t}.png`;
    for (let m = 2; m <= 10; m++) { new Image().src = `assets/chests/c${m}.png`; new Image().src = `assets/chests/c${m}_open.png`; }
    for (const t of ['grass', 'dirt', ...STAGED]) {
      new Image().src = blockSrc(t);
      if (STAGED.includes(t)) for (let i = 1; i <= 3; i++) new Image().src = `assets/blocks/${t}_d${i}.png`;
    }
  }

  // 손상 단계: 맞을 때마다 블록 그림이 바뀜 (원작처럼 재질별로 깨지는 모양이 다름)
  //  - 돌 계열(돌·루비·흑요석): 돌이 점점 작은 조각으로 쪼개짐
  //  - 금: 갈색 금이 그물처럼 번짐
  //  - 다이아: 가운데에서 별 모양으로 금이 퍼짐
  //  paths 를 앞에서부터 순서대로 그리고, 타격 비율만큼 개수를 늘림
  const DAMAGE = {
    cobble: {
      color: '#2a2c31', light: '#b8bcc4',
      paths: ['M4 52 L28 46 L48 58', 'M28 46 L32 20 L26 4', 'M48 58 L72 50 L96 56', 'M72 50 L68 26 L80 4',
        'M48 58 L44 80 L48 96', 'M24 72 L4 76 M24 72 L44 80', 'M68 26 L50 30 L32 20', 'M72 50 L78 74 L96 80 M78 74 L70 96'],
    },
    gold: {
      color: '#5a3a00', light: '#fff1a0',
      paths: ['M50 50 L36 36 L28 18', 'M50 50 L66 40 L84 42', 'M50 50 L44 70 L28 82', 'M50 50 L68 66 L74 88',
        'M36 36 L16 40', 'M66 40 L70 18', 'M44 70 L56 90', 'M68 66 L90 64'],
    },
    diamond: {
      color: '#0d3d57', light: '#ffffff',
      paths: ['M50 50 L32 34', 'M50 50 L68 30', 'M50 50 L72 62', 'M50 50 L34 70', 'M50 50 L52 80',
        'M32 34 L16 22 M68 30 L82 14', 'M72 62 L92 72 M34 70 L14 80', 'M52 80 L50 96 M32 34 L12 40'],
    },
    plain: {
      color: '#120e0c', light: '#ffffff',
      paths: ['M50 50 L36 30 L40 18', 'M50 50 L66 40', 'M50 50 L30 62 L18 58', 'M50 50 L58 70 L54 86',
        'M50 50 L74 60 L86 54', 'M36 30 L22 28', 'M58 70 L72 80', 'M66 40 L80 22'],
    },
  };
  DAMAGE.obsidian = { ...DAMAGE.cobble, color: '#05020c', light: '#c9a4ff' };
  const DAMAGE_KIND = { stone: 'cobble', ruby: 'cobble', obsidian: 'obsidian', gold: 'gold', diamond: 'diamond' };
  function damage(type, ratio) {
    if (ratio <= 0) return '';
    const d = DAMAGE[DAMAGE_KIND[type] || 'plain'];
    const n = Math.max(1, Math.min(d.paths.length, Math.round(ratio * d.paths.length)));
    const ps = d.paths.slice(0, n).join(' ');
    const center = DAMAGE_KIND[type] === 'diamond' ? `<circle cx="50" cy="50" r="${3 + n}" fill="${d.light}" opacity=".35"/>` : '';
    return svg(`${center}<g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${ps}" stroke="${d.light}" stroke-width="5" opacity="${type === 'obsidian' ? .7 : .35}" transform="translate(1.5,1.5)"/>
      <path d="${ps}" stroke="${d.color}" stroke-width="${DAMAGE_KIND[type] === 'diamond' ? 2.5 : 3.5}"/></g>`);
  }

  // ---------- 아이템 ----------
  function pick(color) {
    return svg(`<path d="M24 84 L68 34" stroke="#3b2312" stroke-width="13" stroke-linecap="round"/>
      <path d="M24 84 L68 34" stroke="#a8692f" stroke-width="7" stroke-linecap="round"/>
      <path d="M30 26 Q62 4 92 36" stroke="#1f1f24" stroke-width="17" fill="none" stroke-linecap="round"/>
      <path d="M30 26 Q62 4 92 36" stroke="${color}" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M44 18 Q62 10 78 22" stroke="#ffffff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>`);
  }
  function spinCoin() {
    const g = id('cg');
    return svg(`<defs><radialGradient id="${g}" cx=".35" cy=".3"><stop offset="0" stop-color="#fff2a6"/><stop offset=".6" stop-color="#f5b80c"/><stop offset="1" stop-color="#c47c00"/></radialGradient></defs>
      <circle cx="50" cy="50" r="42" fill="url(#${g})" stroke="#7a4a00" stroke-width="5"/>
      <circle cx="50" cy="50" r="31" fill="#e3263f" stroke="#ffd34d" stroke-width="4"/>
      <path d="M50 30 A20 20 0 1 1 31 44" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M22 40 L32 50 L40 36Z" fill="#fff"/>`);
  }
  function book(superb) {
    const c = superb ? '#6a3fd6' : '#2fa64a', d = superb ? '#3a1f86' : '#1b6a2d', s = superb ? '#ffd84a' : '#d8ff7a';
    return svg(`<path d="M18 20 L74 14 L80 80 L24 88Z" fill="${d}"/>
      <path d="M22 16 L78 10 L82 76 L26 84Z" fill="${c}" stroke="#1d1430" stroke-width="4" stroke-linejoin="round"/>
      <path d="M26 84 L82 76 L84 84 L28 92Z" fill="#fff6dc" stroke="#1d1430" stroke-width="3"/>
      <path d="M52 26 L58 40 L73 41 L61 50 L66 65 L52 56 L39 65 L43 50 L31 41 L46 40Z" fill="${s}" stroke="#1d1430" stroke-width="2.5"/>
      ${superb ? '<circle cx="74" cy="20" r="4" fill="#fff"/><circle cx="30" cy="70" r="3" fill="#fff"/>' : ''}`);
  }
  function tnt() {
    return svg(`<path d="M50 14 Q56 4 64 8" stroke="#3b2a1a" stroke-width="4" fill="none"/><circle cx="66" cy="7" r="5" fill="#ffcf3a"/>
      <rect x="24" y="16" width="52" height="76" rx="10" fill="#d42525" stroke="#5a0b0b" stroke-width="5"/>
      <rect x="24" y="40" width="52" height="24" fill="#fff4e0" stroke="#5a0b0b" stroke-width="3"/>
      <text x="50" y="59" text-anchor="middle" font-size="19" font-weight="900" font-family="Arial Black,Arial" fill="#c21b1b">TNT</text>
      <path d="M32 22 L32 36 M32 68 L32 86" stroke="#ff7b7b" stroke-width="4" stroke-linecap="round"/>`);
  }
  // 아이템 이미지 (assets/items/*.png, Gemini로 생성)
  const ITEM_TYPES = ['pick1', 'pick2', 'pick3', 'pick5', 'pick7', 'spin', 'book', 'superbook', 'tnt'];
  function item(type) {
    return ITEM_TYPES.includes(type) ? `<img class="itemimg" src="assets/items/${type}.png" alt="" draggable="false">` : '';
  }

  // ---------- 보물상자 ----------
  // 보물상자 이미지 (assets/chests/c{최소배율}.png / _open.png)
  function chest(conf, open) {
    return `<img class="chestimg" src="assets/chests/c${conf.min}${open ? '_open' : ''}.png" alt="" draggable="false">`;
  }

  // ---------- 가상 상품 카드 ----------
  const ELEM = {
    obsidian: ['#3b2366', '#a46bff', '#120a22'], rainbow: ['#ff7aa2', '#6aa8ff', '#3a2a60'], void: ['#1e2a5a', '#7c83ff', '#0b1024'],
    diamond: ['#c6f6ff', '#2bb3e6', '#0b4a63'], gold: ['#ffe9a0', '#e39a00', '#6b4300'], lava: ['#ffb199', '#e0301e', '#5a0d06'],
    ruby: ['#ffd0dc', '#e0194a', '#5c0720'], sapphire: ['#cfe2ff', '#2a62e0', '#0e2560'], thunder: ['#fff7a8', '#f0b400', '#5a4300'],
    stone: ['#eceff3', '#7b8494', '#2c313a'], clover: ['#d4ffd9', '#22a447', '#0c4a1c'],
  };
  function creature(elem, idx) {
    const [l, m, d] = ELEM[elem] || ELEM.stone;
    const g = id('cr');
    const shapes = [
      'M100 30 L150 70 L135 150 L65 150 L50 70Z',           // 보석형
      'M100 28 C150 28 165 80 155 120 C145 160 55 160 45 120 C35 80 50 28 100 28Z', // 둥근형
      'M100 26 L156 58 L156 122 L100 154 L44 122 L44 58Z',   // 육각형
    ];
    const ears = idx === 1
      ? `<path d="M60 52 L52 18 L84 40Z M140 52 L148 18 L116 40Z" fill="${m}" stroke="${d}" stroke-width="5"/>`
      : idx === 2 ? `<path d="M100 26 L100 6 M90 10 L110 10" stroke="${d}" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="6" r="6" fill="${l}" stroke="${d}" stroke-width="3"/>` : '';
    return svg(`<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l}"/><stop offset="1" stop-color="${m}"/></linearGradient></defs>
      <ellipse cx="100" cy="168" rx="55" ry="9" fill="#000" opacity=".25"/>
      ${ears}
      <path d="${shapes[idx % 3]}" fill="url(#${g})" stroke="${d}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M70 60 L90 50" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>
      <ellipse cx="82" cy="98" rx="9" ry="12" fill="${d}"/><ellipse cx="118" cy="98" rx="9" ry="12" fill="${d}"/>
      <circle cx="85" cy="93" r="3.5" fill="#fff"/><circle cx="121" cy="93" r="3.5" fill="#fff"/>
      <path d="M88 122 Q100 132 112 122" stroke="${d}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="70" cy="116" r="7" fill="#ff7a9a" opacity=".5"/><circle cx="130" cy="116" r="7" fill="#ff7a9a" opacity=".5"/>`, '0 0 200 180');
  }
  function card(c, opts = {}) {
    const [l, m, d] = ELEM[c.elem] || ELEM.stone;
    const g = root.CONFIG.GRADES.find(x => x.id === c.grade);
    const stars = '★'.repeat(Math.max(1, 8 - root.CONFIG.GRADES.indexOf(g)));
    return `<div class="card ${opts.cls || ''} grade-${c.grade}" style="--l:${l};--m:${m};--d:${d}">
      <div class="card-in">
        <div class="card-top"><span class="card-grade" style="background:${g.color}">${c.grade}상</span><span class="card-stars">${stars}</span></div>
        <div class="card-art">${creature(c.elem, c.idx || 0)}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-foot">LUCKY DIG · No.${String('SABCDEFG'.indexOf(c.grade) * 6 + (c.idx || 0) + 1).padStart(2, '0')}</div>
      </div>
      ${'SAB'.includes(c.grade) ? '<div class="card-holo"></div>' : ''}
    </div>`;
  }

  root.Art = { block, blockSrc, preload, damage, item, pick, chest, card, spinCoin };
})(window);

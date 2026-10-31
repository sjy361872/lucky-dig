// =====================================================
//  게임 수치 설정 — 밸런스 조정은 이 파일만 고치면 됩니다
// =====================================================
(function (root) {
  const CONFIG = {
    GAME_NAME: '럭키 디그',
    START_POINTS: 10000,          // 디버그용 시작 포인트
    CHARGE_AMOUNTS: [10000, 50000, 100000, 1000000], // 무료 충전 버튼 금액
    BETS: [1000, 2000, 3000, 5000, 10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
    DEFAULT_BET: 1000,

    S_CAP: 30,                    // S상 스코어 상한 (소비 포인트 × 30)
    // 모드별 등급 출현율(%) — 원작 상품 목록 기준. 등급 기준 스코어·환원 값은 두 모드 동일
    //  MILD: 본전 근처(D·E상)가 자주 → 오래 즐김 / HARD: 대부분 G상이지만 S·A상이 약 2배 자주
    MODES: {
      mild: { name: 'MILD', meter: 2, rates: { S: 1.8, A: 2.0, B: 3.0, C: 5.5, D: 22.7, E: 27.5, F: 22.5, G: 15.0 } },
      hard: { name: 'HARD', meter: 5, rates: { S: 3.5, A: 4.5, B: 6.0, C: 6.0, D: 5.0, E: 8.0, F: 10.0, G: 57.0 } },
    },
    COLS: 5,
    ROWS: 6,
    SLOT_ROWS: 3,

    // 등급: 기준 = 소비 포인트 × need, 출현율 rate(%)
    // 카드 환원 포인트 = 소비 포인트 × need × 카드별 r (원작 관찰: 환원 ≈ 등급 기준의 0.9~1.2배)
    // r 평균 1.0 → 기대 환원율 약 90%
    GRADES: [
      { id: 'S', need: 7.0, rate: 1.8, color: '#e5283a' },
      { id: 'A', need: 4.0, rate: 2.0, color: '#f2622b' },
      { id: 'B', need: 2.0, rate: 3.0, color: '#f59e1b' },
      { id: 'C', need: 1.5, rate: 5.5, color: '#f4c21a' },
      { id: 'D', need: 1.2, rate: 22.7, color: '#1fa155' },
      { id: 'E', need: 0.6, rate: 27.5, color: '#1e86e0' },
      { id: 'F', need: 0.4, rate: 22.5, color: '#2457b8' },
      { id: 'G', need: 0.2, rate: 15.0, color: '#7c3aed' },
    ],

    // 블록: hp = 부서질 때까지 필요한 타격, mult = 스코어 배율(× 소비 포인트)
    BLOCKS: {
      grass:     { name: '풀',      hp: 1, mult: 0 },
      dirt:      { name: '흙',      hp: 1, mult: 0 },
      stone:     { name: '돌',      hp: 2, mult: 0.001 },
      ruby:      { name: '루비',    hp: 4, mult: 0.01 },
      gold:      { name: '금',      hp: 5, mult: 0.03 },
      diamond:   { name: '다이아',  hp: 6, mult: 0.05 },
      obsidian:  { name: '흑요석',  hp: 7, mult: 0.25 },
      explosive: { name: '폭발 광석', hp: 2, mult: 0.005 },
      mystery:   { name: '?',       hp: 4, mult: null },
    },
    // ?블록을 부쉈을 때 나올 수 있는 배율 (가중치)
    MYSTERY_VALUES: [
      { mult: 0.005, w: 30 }, { mult: 0.01, w: 25 }, { mult: 0.025, w: 20 },
      { mult: 0.05, w: 12 }, { mult: 0.1, w: 8 }, { mult: 0.3, w: 5 },
    ],
    EXPLOSION_DAMAGE: 2,

    // 곡괭이: power = 타격 횟수
    PICKS: {
      pick1: { name: '돌 곡괭이',     power: 1, color: '#8d8d8d' },
      pick2: { name: '철 곡괭이',     power: 2, color: '#c9ced6' },
      pick3: { name: '금 곡괭이',     power: 3, color: '#f3c12c' },
      pick5: { name: '다이아 곡괭이', power: 5, color: '#5fd3f5' },
      pick7: { name: '흑요석 곡괭이', power: 7, color: '#6b3fd1' },
    },

    // 보물상자: min = 최소 배율 (실제 배율은 min~10)
    CHESTS: [
      { min: 2, color: '#7a5233', trim: '#4a4a4a' },
      { min: 3, color: '#8a5a2b', trim: '#e0b23a' },
      { min: 4, color: '#3d3d3d', trim: '#e0b23a' },
      { min: 5, color: '#e8e8e8', trim: '#e0b23a' },
      { min: 6, color: '#1f5fd1', trim: '#e0b23a' },
      { min: 7, color: '#1f9d4a', trim: '#e0b23a' },
      { min: 8, color: '#d1263a', trim: '#e0b23a' },
      { min: 9, color: '#f2c40f', trim: '#fff0a0' },
      { min: 10, color: 'rainbow', trim: '#ffffff' },
    ],

    // 상품 카드: 등급별 6장 (포켓몬풍 오리지널 캐릭터, 그림은 assets/cards/{등급}{번호}.jpg)
    // r = 환원 계수 (환원 포인트 = 소비 포인트 × 등급 기준 × r), 카드마다 다르고 등급마다 범위도 다름
    // w = 등급 안에서 나올 비중(%), 비싼 카드일수록 드묾. 등급 안 평균 r = 1.0 → 전체 환원율 약 90%
    CARDS: {
      S: [
        { name: '태초의 흑요룡', elem: 'obsidian', r: 2.2, w: 3.9 },
        { name: '무지개 결정기린', elem: 'rainbow', r: 1.6, w: 7.3 },
        { name: '황금 용왕', elem: 'gold', r: 1.25, w: 11.9 },
        { name: '별빛 수정룡', elem: 'diamond', r: 1.0, w: 18.5 },
        { name: '심연의 광산괴수', elem: 'void', r: 0.85, w: 25.6 },
        { name: '대지의 거신', elem: 'stone', r: 0.75, w: 32.8 },
      ],
      A: [
        { name: '루비 드라곤', elem: 'ruby', r: 1.8, w: 6.0 },
        { name: '다이아 코뿔', elem: 'diamond', r: 1.4, w: 9.5 },
        { name: '황금 여왕벌', elem: 'gold', r: 1.15, w: 13.6 },
        { name: '번개 그리폰', elem: 'thunder', r: 0.95, w: 19.4 },
        { name: '마그마콩', elem: 'lava', r: 0.85, w: 23.7 },
        { name: '빙결학', elem: 'sapphire', r: 0.78, w: 27.8 },
      ],
      B: [
        { name: '루비 피닉스', elem: 'ruby', r: 1.6, w: 7.1 },
        { name: '수정 늑대', elem: 'diamond', r: 1.3, w: 10.6 },
        { name: '번개 족제비', elem: 'thunder', r: 1.1, w: 14.5 },
        { name: '황금 부엉', elem: 'gold', r: 0.95, w: 19.1 },
        { name: '에메랄드 사슴', elem: 'clover', r: 0.88, w: 22.1 },
        { name: '사파이어 해마', elem: 'sapphire', r: 0.8, w: 26.5 },
      ],
      C: [
        { name: '수정 여우', elem: 'diamond', r: 1.5, w: 7.9 },
        { name: '황금 풍뎅', elem: 'gold', r: 1.25, w: 11.2 },
        { name: '불꽃 도롱', elem: 'lava', r: 1.08, w: 14.9 },
        { name: '석영 골렘', elem: 'stone', r: 0.96, w: 18.7 },
        { name: '별가루 토끼', elem: 'void', r: 0.88, w: 22.1 },
        { name: '청동 거북', elem: 'thunder', r: 0.82, w: 25.3 },
      ],
      D: [
        { name: '광부냥', elem: 'gold', r: 1.45, w: 7.9 },
        { name: '다이너굴', elem: 'lava', r: 1.2, w: 11.8 },
        { name: '곡괭펭', elem: 'sapphire', r: 1.05, w: 15.6 },
        { name: '찌릿두더지', elem: 'thunder', r: 0.97, w: 18.4 },
        { name: '네잎토', elem: 'clover', r: 0.9, w: 21.5 },
        { name: '수정게', elem: 'diamond', r: 0.84, w: 24.9 },
      ],
      E: [
        { name: '루비달팽', elem: 'ruby', r: 1.6, w: 7.5 },
        { name: '고드름펭', elem: 'sapphire', r: 1.3, w: 10.9 },
        { name: '동굴박', elem: 'void', r: 1.1, w: 14.6 },
        { name: '버섯포자', elem: 'ruby', r: 0.95, w: 18.9 },
        { name: '석탄곰', elem: 'stone', r: 0.86, w: 22.5 },
        { name: '자갈도치', elem: 'stone', r: 0.8, w: 25.6 },
      ],
      F: [
        { name: '반딧랜턴', elem: 'thunder', r: 1.7, w: 7.1 },
        { name: '구리찍찍', elem: 'gold', r: 1.35, w: 10.5 },
        { name: '횃불도롱', elem: 'lava', r: 1.1, w: 14.7 },
        { name: '점토개굴', elem: 'clover', r: 0.95, w: 18.8 },
        { name: '모래지렁', elem: 'gold', r: 0.85, w: 22.7 },
        { name: '철광벌레', elem: 'stone', r: 0.78, w: 26.2 },
      ],
      G: [
        { name: '꼬마돌', elem: 'stone', r: 2.0, w: 5.7 },
        { name: '흙두지', elem: 'stone', r: 1.5, w: 9.1 },
        { name: '잎새벌레', elem: 'clover', r: 1.15, w: 14.0 },
        { name: '물방울링', elem: 'sapphire', r: 0.95, w: 19.1 },
        { name: '이끼달팽', elem: 'clover', r: 0.82, w: 24.2 },
        { name: '먼지토', elem: 'stone', r: 0.75, w: 28.0 },
      ],
    },
  };
  root.CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);

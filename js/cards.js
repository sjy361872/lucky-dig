// =====================================================
//  몬스터 카드 목록 — 광산 11곳 × 등급(S~F) + G
//   몬스터 그림(assets/mobs)·도감 카드(assets/cards)와 짝. 출시 전 자체 화풍으로 교체 예정 (CLAUDE.md)
// =====================================================
(function (root) {
  const CARDS = {
    TIERS: {
      1000: { name: '풀숲 입구', cards: {
        S: [{ name: '새싹왕 엘크', elem: 'clover', r: 2.0, w: 1.7 }, { name: '무지개 나비여왕', elem: 'rainbow', r: 1.55, w: 5.8 }, { name: '황금 풍뎅이왕', elem: 'gold', r: 1.28, w: 14.6 }, { name: '꽃잎 드래곤', elem: 'clover', r: 1.1, w: 30.2 }, { name: '고목 거인', elem: 'stone', r: 1.0, w: 47.7 }],
        A: [{ name: '장수풍뎅', elem: 'stone', r: 1.75, w: 1.6 }, { name: '잎새 여우', elem: 'clover', r: 1.413, w: 5.8 }, { name: '꿀벌 기사', elem: 'gold', r: 1.21, w: 14.9 }, { name: '민들레 양', elem: 'clover', r: 1.075, w: 30.5 }, { name: '이슬 잠자리', elem: 'sapphire', r: 1.0, w: 47.2 }],
        B: [{ name: '도토리 다람', elem: 'stone', r: 2.0, w: 1.7 }, { name: '클로버 토끼', elem: 'clover', r: 1.55, w: 5.8 }, { name: '무당벌레', elem: 'ruby', r: 1.28, w: 14.6 }, { name: '덩굴 뱀', elem: 'clover', r: 1.1, w: 30.2 }, { name: '반딧불 고양이', elem: 'thunder', r: 1.0, w: 47.7 }],
        C: [{ name: '풀잎 메뚜기', elem: 'clover', r: 1.333, w: 1.4 }, { name: '흙강아지', elem: 'stone', r: 1.183, w: 5.9 }, { name: '솔방울 고슴', elem: 'stone', r: 1.093, w: 15.5 }, { name: '꽃봉오리 새', elem: 'ruby', r: 1.033, w: 31.0 }, { name: '버섯 달팽', elem: 'ruby', r: 1.0, w: 46.2 }],
        D: [{ name: '새싹 두더지', elem: 'clover', r: 1.25, w: 1.3 }, { name: '꼬물 애벌레', elem: 'clover', r: 1.137, w: 5.9 }, { name: '조약돌 거북', elem: 'stone', r: 1.07, w: 15.6 }, { name: '꿀단지 곰', elem: 'gold', r: 1.025, w: 31.1 }, { name: '나뭇잎 개구리', elem: 'clover', r: 1.0, w: 46.1 }],
        E: [{ name: '잔디 쥐', elem: 'clover', r: 2.0, w: 1.7 }, { name: '흙덩이', elem: 'stone', r: 1.55, w: 5.8 }, { name: '씨앗콩', elem: 'clover', r: 1.28, w: 14.6 }, { name: '거미줄 거미', elem: 'void', r: 1.1, w: 30.2 }, { name: '나비 번데기', elem: 'clover', r: 1.0, w: 47.7 }],
        F: [{ name: '먼지 벌레', elem: 'stone', r: 1.5, w: 1.5 }, { name: '풀씨', elem: 'clover', r: 1.275, w: 5.8 }, { name: '진흙 방울', elem: 'stone', r: 1.14, w: 15.2 }, { name: '꼬마 개미', elem: 'ruby', r: 1.05, w: 30.8 }, { name: '이끼공', elem: 'clover', r: 1.0, w: 46.7 }],
      } },
      2000: { name: '개울가 동굴', cards: {
        S: [{ name: '폭포의 용신', elem: 'sapphire', r: 2.0, w: 1.7 }, { name: '달빛 수달왕', elem: 'diamond', r: 1.55, w: 5.8 }, { name: '청옥 거북현자', elem: 'sapphire', r: 1.28, w: 14.6 }, { name: '물안개 기린', elem: 'rainbow', r: 1.1, w: 30.2 }, { name: '이끼 수호룡', elem: 'clover', r: 1.0, w: 47.7 }],
        A: [{ name: '물방울 백조', elem: 'sapphire', r: 1.75, w: 1.6 }, { name: '청개구리 기사', elem: 'clover', r: 1.413, w: 5.8 }, { name: '은빛 잉어', elem: 'diamond', r: 1.21, w: 14.9 }, { name: '조개 공주', elem: 'rainbow', r: 1.075, w: 30.5 }, { name: '이끼 사슴', elem: 'clover', r: 1.0, w: 47.2 }],
        B: [{ name: '수달', elem: 'stone', r: 2.0, w: 1.7 }, { name: '가재 전사', elem: 'ruby', r: 1.55, w: 5.8 }, { name: '물총새', elem: 'sapphire', r: 1.28, w: 14.6 }, { name: '개울 도롱뇽', elem: 'sapphire', r: 1.1, w: 30.2 }, { name: '이끼 곰', elem: 'clover', r: 1.0, w: 47.7 }],
        C: [{ name: '물방울 슬라임', elem: 'sapphire', r: 1.333, w: 1.4 }, { name: '소금쟁이', elem: 'sapphire', r: 1.183, w: 5.9 }, { name: '조약돌 게', elem: 'stone', r: 1.093, w: 15.5 }, { name: '물풀 해파리', elem: 'clover', r: 1.033, w: 31.0 }, { name: '올챙이 대장', elem: 'sapphire', r: 1.0, w: 46.2 }],
        D: [{ name: '개울 피라미', elem: 'sapphire', r: 1.25, w: 1.3 }, { name: '물이끼 고둥', elem: 'clover', r: 1.137, w: 5.9 }, { name: '젖은 쥐', elem: 'stone', r: 1.07, w: 15.6 }, { name: '수련 개구리', elem: 'clover', r: 1.025, w: 31.1 }, { name: '물거품 게', elem: 'sapphire', r: 1.0, w: 46.1 }],
        E: [{ name: '물방울 요정', elem: 'sapphire', r: 2.0, w: 1.7 }, { name: '이끼 덩이', elem: 'clover', r: 1.55, w: 5.8 }, { name: '젖은 돌', elem: 'stone', r: 1.28, w: 14.6 }, { name: '물벼룩', elem: 'sapphire', r: 1.1, w: 30.2 }, { name: '갈대 새싹', elem: 'clover', r: 1.0, w: 47.7 }],
        F: [{ name: '물거품', elem: 'sapphire', r: 1.5, w: 1.5 }, { name: '모래알', elem: 'gold', r: 1.275, w: 5.8 }, { name: '물풀', elem: 'clover', r: 1.14, w: 15.2 }, { name: '진흙 콩', elem: 'stone', r: 1.05, w: 30.8 }, { name: '이슬', elem: 'sapphire', r: 1.0, w: 46.7 }],
      } },
      3000: { name: '버섯 동굴', cards: {
        S: [{ name: '포자의 여왕', elem: 'ruby', r: 2.0, w: 1.7 }, { name: '발광 버섯룡', elem: 'void', r: 1.55, w: 5.8 }, { name: '균사의 현자', elem: 'clover', r: 1.28, w: 14.6 }, { name: '무지개 송로왕', elem: 'rainbow', r: 1.1, w: 30.2 }, { name: '보라 독버섯 마왕', elem: 'void', r: 1.0, w: 47.7 }],
        A: [{ name: '독버섯 두꺼비', elem: 'void', r: 1.75, w: 1.6 }, { name: '발광 해파리 버섯', elem: 'sapphire', r: 1.413, w: 5.8 }, { name: '포자 나방', elem: 'stone', r: 1.21, w: 14.9 }, { name: '송이 기사', elem: 'gold', r: 1.075, w: 30.5 }, { name: '빨간 갓 여우', elem: 'ruby', r: 1.0, w: 47.2 }],
        B: [{ name: '형광 지렁', elem: 'thunder', r: 2.0, w: 1.7 }, { name: '버섯 다람', elem: 'ruby', r: 1.55, w: 5.8 }, { name: '포자 박쥐', elem: 'void', r: 1.28, w: 14.6 }, { name: '표고 곰', elem: 'stone', r: 1.1, w: 30.2 }, { name: '곰팡이 고양이', elem: 'clover', r: 1.0, w: 47.7 }],
        C: [{ name: '팽이버섯', elem: 'stone', r: 1.333, w: 1.4 }, { name: '파란 버섯콩', elem: 'sapphire', r: 1.183, w: 5.9 }, { name: '포자 공', elem: 'clover', r: 1.093, w: 15.5 }, { name: '버섯 개미', elem: 'ruby', r: 1.033, w: 31.0 }, { name: '형광 달팽', elem: 'thunder', r: 1.0, w: 46.2 }],
        D: [{ name: '빨간 갓버섯', elem: 'ruby', r: 1.25, w: 1.3 }, { name: '느타리', elem: 'stone', r: 1.137, w: 5.9 }, { name: '곰팡이 방울', elem: 'clover', r: 1.07, w: 15.6 }, { name: '동굴 귀뚜라미', elem: 'stone', r: 1.025, w: 31.1 }, { name: '형광 이끼', elem: 'thunder', r: 1.0, w: 46.1 }],
        E: [{ name: '작은 버섯', elem: 'ruby', r: 2.0, w: 1.7 }, { name: '포자 먼지', elem: 'clover', r: 1.55, w: 5.8 }, { name: '동굴 쥐며느리', elem: 'stone', r: 1.28, w: 14.6 }, { name: '그늘 이끼', elem: 'clover', r: 1.1, w: 30.2 }, { name: '버섯 새싹', elem: 'ruby', r: 1.0, w: 47.7 }],
        F: [{ name: '곰팡이 점', elem: 'clover', r: 1.5, w: 1.5 }, { name: '포자 알', elem: 'void', r: 1.275, w: 5.8 }, { name: '젖은 낙엽', elem: 'stone', r: 1.14, w: 15.2 }, { name: '균사 실', elem: 'stone', r: 1.05, w: 30.8 }, { name: '버섯 조각', elem: 'ruby', r: 1.0, w: 46.7 }],
      } },
      5000: { name: '석탄 갱도', cards: {
        S: [{ name: '갱도의 화로신', elem: 'lava', r: 2.0, w: 1.7 }, { name: '강철 광차룡', elem: 'stone', r: 1.55, w: 5.8 }, { name: '랜턴 불사조', elem: 'gold', r: 1.28, w: 14.6 }, { name: '석탄 거신', elem: 'stone', r: 1.1, w: 30.2 }, { name: '횃불의 기린', elem: 'lava', r: 1.0, w: 47.7 }],
        A: [{ name: '광차 멧돼지', elem: 'stone', r: 1.75, w: 1.6 }, { name: '불씨 여우', elem: 'lava', r: 1.413, w: 5.8 }, { name: '곡괭이 사슴', elem: 'stone', r: 1.21, w: 14.9 }, { name: '석탄 두꺼비', elem: 'stone', r: 1.075, w: 30.5 }, { name: '램프 부엉', elem: 'gold', r: 1.0, w: 47.2 }],
        B: [{ name: '횃불 도마뱀', elem: 'lava', r: 2.0, w: 1.7 }, { name: '광부 너구리', elem: 'stone', r: 1.55, w: 5.8 }, { name: '숯불 곰', elem: 'lava', r: 1.28, w: 14.6 }, { name: '톱니 쥐', elem: 'thunder', r: 1.1, w: 30.2 }, { name: '연기 고양이', elem: 'void', r: 1.0, w: 47.7 }],
        C: [{ name: '불씨 방울', elem: 'lava', r: 1.333, w: 1.4 }, { name: '레일 지네', elem: 'stone', r: 1.183, w: 5.9 }, { name: '석탄 두더지', elem: 'stone', r: 1.093, w: 15.5 }, { name: '헬멧 펭귄', elem: 'sapphire', r: 1.033, w: 31.0 }, { name: '그을음 박쥐', elem: 'void', r: 1.0, w: 46.2 }],
        D: [{ name: '석탄 조각', elem: 'stone', r: 1.25, w: 1.3 }, { name: '불티', elem: 'lava', r: 1.137, w: 5.9 }, { name: '녹슨 못', elem: 'ruby', r: 1.07, w: 15.6 }, { name: '갱도 쥐', elem: 'stone', r: 1.025, w: 31.1 }, { name: '양초 도깨비', elem: 'gold', r: 1.0, w: 46.1 }],
        E: [{ name: '석탄 가루', elem: 'stone', r: 2.0, w: 1.7 }, { name: '성냥', elem: 'lava', r: 1.55, w: 5.8 }, { name: '그을음', elem: 'void', r: 1.28, w: 14.6 }, { name: '나무 받침', elem: 'stone', r: 1.1, w: 30.2 }, { name: '녹 방울', elem: 'ruby', r: 1.0, w: 47.7 }],
        F: [{ name: '검댕', elem: 'void', r: 1.5, w: 1.5 }, { name: '돌가루', elem: 'stone', r: 1.275, w: 5.8 }, { name: '불씨 점', elem: 'lava', r: 1.14, w: 15.2 }, { name: '나무 조각', elem: 'stone', r: 1.05, w: 30.8 }, { name: '쇠 부스러기', elem: 'stone', r: 1.0, w: 46.7 }],
      } },
      10000: { name: '보석 광맥', cards: {
        S: [{ name: '태초의 흑요룡', elem: 'obsidian', r: 2.0, w: 1.7 }, { name: '무지개 결정기린', elem: 'rainbow', r: 1.55, w: 5.8 }, { name: '황금 용왕', elem: 'gold', r: 1.28, w: 14.6 }, { name: '별빛 수정룡', elem: 'diamond', r: 1.1, w: 30.2 }, { name: '심연의 광산괴수', elem: 'void', r: 1.0, w: 47.7 }],
        A: [{ name: '루비 드라곤', elem: 'ruby', r: 1.75, w: 1.6 }, { name: '다이아 코뿔', elem: 'diamond', r: 1.413, w: 5.8 }, { name: '황금 여왕벌', elem: 'gold', r: 1.21, w: 14.9 }, { name: '번개 그리폰', elem: 'thunder', r: 1.075, w: 30.5 }, { name: '마그마콩', elem: 'lava', r: 1.0, w: 47.2 }],
        B: [{ name: '루비 피닉스', elem: 'ruby', r: 2.0, w: 1.7 }, { name: '수정 늑대', elem: 'diamond', r: 1.55, w: 5.8 }, { name: '번개 족제비', elem: 'thunder', r: 1.28, w: 14.6 }, { name: '황금 부엉', elem: 'gold', r: 1.1, w: 30.2 }, { name: '에메랄드 사슴', elem: 'clover', r: 1.0, w: 47.7 }],
        C: [{ name: '수정 여우', elem: 'diamond', r: 1.333, w: 1.4 }, { name: '황금 풍뎅', elem: 'gold', r: 1.183, w: 5.9 }, { name: '불꽃 도롱', elem: 'lava', r: 1.093, w: 15.5 }, { name: '석영 골렘', elem: 'stone', r: 1.033, w: 31.0 }, { name: '별가루 토끼', elem: 'void', r: 1.0, w: 46.2 }],
        D: [{ name: '광부냥', elem: 'gold', r: 1.25, w: 1.3 }, { name: '다이너굴', elem: 'lava', r: 1.137, w: 5.9 }, { name: '곡괭펭', elem: 'sapphire', r: 1.07, w: 15.6 }, { name: '찌릿두더지', elem: 'thunder', r: 1.025, w: 31.1 }, { name: '네잎토', elem: 'clover', r: 1.0, w: 46.1 }],
        E: [{ name: '루비달팽', elem: 'ruby', r: 2.0, w: 1.7 }, { name: '고드름펭', elem: 'sapphire', r: 1.55, w: 5.8 }, { name: '동굴박', elem: 'void', r: 1.28, w: 14.6 }, { name: '버섯포자', elem: 'ruby', r: 1.1, w: 30.2 }, { name: '석탄곰', elem: 'stone', r: 1.0, w: 47.7 }],
        F: [{ name: '반딧랜턴', elem: 'thunder', r: 1.5, w: 1.5 }, { name: '구리찍찍', elem: 'gold', r: 1.275, w: 5.8 }, { name: '횃불도롱', elem: 'lava', r: 1.14, w: 15.2 }, { name: '점토개굴', elem: 'clover', r: 1.05, w: 30.8 }, { name: '모래지렁', elem: 'gold', r: 1.0, w: 46.7 }],
      } },
      20000: { name: '수정 동굴', cards: {
        S: [{ name: '빙정의 여제', elem: 'sapphire', r: 2.0, w: 1.7 }, { name: '오로라 늑대왕', elem: 'rainbow', r: 1.55, w: 5.8 }, { name: '수정 고래', elem: 'diamond', r: 1.28, w: 14.6 }, { name: '설화 드래곤', elem: 'diamond', r: 1.1, w: 30.2 }, { name: '얼음 거신', elem: 'sapphire', r: 1.0, w: 47.7 }],
        A: [{ name: '눈꽃 여우', elem: 'diamond', r: 1.75, w: 1.6 }, { name: '빙하 매머드', elem: 'sapphire', r: 1.413, w: 5.8 }, { name: '수정 사슴', elem: 'diamond', r: 1.21, w: 14.9 }, { name: '서리 부엉', elem: 'sapphire', r: 1.075, w: 30.5 }, { name: '고드름 용', elem: 'sapphire', r: 1.0, w: 47.2 }],
        B: [{ name: '눈사람 곰', elem: 'diamond', r: 2.0, w: 1.7 }, { name: '수정 고슴', elem: 'diamond', r: 1.55, w: 5.8 }, { name: '빙어', elem: 'sapphire', r: 1.28, w: 14.6 }, { name: '눈토끼', elem: 'diamond', r: 1.1, w: 30.2 }, { name: '서리 나비', elem: 'sapphire', r: 1.0, w: 47.7 }],
        C: [{ name: '얼음 펭귄', elem: 'sapphire', r: 1.333, w: 1.4 }, { name: '수정 박쥐', elem: 'diamond', r: 1.183, w: 5.9 }, { name: '눈송이', elem: 'diamond', r: 1.093, w: 15.5 }, { name: '빙결 게', elem: 'sapphire', r: 1.033, w: 31.0 }, { name: '고드름 박쥐', elem: 'sapphire', r: 1.0, w: 46.2 }],
        D: [{ name: '얼음 조각', elem: 'sapphire', r: 1.25, w: 1.3 }, { name: '수정 새싹', elem: 'diamond', r: 1.137, w: 5.9 }, { name: '눈덩이', elem: 'diamond', r: 1.07, w: 15.6 }, { name: '서리 달팽', elem: 'sapphire', r: 1.025, w: 31.1 }, { name: '빙판 쥐', elem: 'sapphire', r: 1.0, w: 46.1 }],
        E: [{ name: '작은 고드름', elem: 'sapphire', r: 2.0, w: 1.7 }, { name: '수정 가루', elem: 'diamond', r: 1.55, w: 5.8 }, { name: '서리꽃', elem: 'diamond', r: 1.28, w: 14.6 }, { name: '눈알갱이', elem: 'diamond', r: 1.1, w: 30.2 }, { name: '얼음 방울', elem: 'sapphire', r: 1.0, w: 47.7 }],
        F: [{ name: '서리 점', elem: 'sapphire', r: 1.5, w: 1.5 }, { name: '눈 부스러기', elem: 'diamond', r: 1.275, w: 5.8 }, { name: '수정 티끌', elem: 'diamond', r: 1.14, w: 15.2 }, { name: '찬 바람', elem: 'sapphire', r: 1.05, w: 30.8 }, { name: '얼음 알', elem: 'sapphire', r: 1.0, w: 46.7 }],
      } },
      30000: { name: '용암 지대', cards: {
        S: [{ name: '화산의 용왕', elem: 'lava', r: 2.0, w: 1.7 }, { name: '흑염 불사조', elem: 'obsidian', r: 1.55, w: 5.8 }, { name: '마그마 기린', elem: 'lava', r: 1.28, w: 14.6 }, { name: '홍옥 사자왕', elem: 'ruby', r: 1.1, w: 30.2 }, { name: '용암 거북신', elem: 'lava', r: 1.0, w: 47.7 }],
        A: [{ name: '불꽃 사자', elem: 'lava', r: 1.75, w: 1.6 }, { name: '흑요 표범', elem: 'obsidian', r: 1.413, w: 5.8 }, { name: '마그마 뱀', elem: 'lava', r: 1.21, w: 14.9 }, { name: '루비 도마뱀', elem: 'ruby', r: 1.075, w: 30.5 }, { name: '화산재 매', elem: 'stone', r: 1.0, w: 47.2 }],
        B: [{ name: '용암 거북', elem: 'lava', r: 2.0, w: 1.7 }, { name: '불 도롱뇽', elem: 'lava', r: 1.55, w: 5.8 }, { name: '화염 박쥐', elem: 'lava', r: 1.28, w: 14.6 }, { name: '흑요 게', elem: 'obsidian', r: 1.1, w: 30.2 }, { name: '잉걸 여우', elem: 'ruby', r: 1.0, w: 47.7 }],
        C: [{ name: '불덩이', elem: 'lava', r: 1.333, w: 1.4 }, { name: '용암 슬라임', elem: 'lava', r: 1.183, w: 5.9 }, { name: '화산석 골렘', elem: 'stone', r: 1.093, w: 15.5 }, { name: '불개미', elem: 'ruby', r: 1.033, w: 31.0 }, { name: '연기 뱀', elem: 'void', r: 1.0, w: 46.2 }],
        D: [{ name: '불씨 쥐', elem: 'lava', r: 1.25, w: 1.3 }, { name: '흑요 조각', elem: 'obsidian', r: 1.137, w: 5.9 }, { name: '용암 방울', elem: 'lava', r: 1.07, w: 15.6 }, { name: '화산재 토끼', elem: 'stone', r: 1.025, w: 31.1 }, { name: '숯 고슴', elem: 'stone', r: 1.0, w: 46.1 }],
        E: [{ name: '작은 불꽃', elem: 'lava', r: 2.0, w: 1.7 }, { name: '화산재', elem: 'stone', r: 1.55, w: 5.8 }, { name: '뜨거운 돌', elem: 'ruby', r: 1.28, w: 14.6 }, { name: '유황 방울', elem: 'gold', r: 1.1, w: 30.2 }, { name: '그을린 콩', elem: 'stone', r: 1.0, w: 47.7 }],
        F: [{ name: '불티 점', elem: 'lava', r: 1.5, w: 1.5 }, { name: '재 가루', elem: 'stone', r: 1.275, w: 5.8 }, { name: '용암 알', elem: 'lava', r: 1.14, w: 15.2 }, { name: '연기 실', elem: 'void', r: 1.05, w: 30.8 }, { name: '뜨거운 모래', elem: 'gold', r: 1.0, w: 46.7 }],
      } },
      50000: { name: '번개 광산', cards: {
        S: [{ name: '뇌신 그리폰', elem: 'thunder', r: 2.0, w: 1.7 }, { name: '강철 용', elem: 'stone', r: 1.55, w: 5.8 }, { name: '번개 기린', elem: 'thunder', r: 1.28, w: 14.6 }, { name: '자석 거신', elem: 'stone', r: 1.1, w: 30.2 }, { name: '황금 전격 사자', elem: 'gold', r: 1.0, w: 47.7 }],
        A: [{ name: '번개 늑대', elem: 'thunder', r: 1.75, w: 1.6 }, { name: '구리 독수리', elem: 'gold', r: 1.413, w: 5.8 }, { name: '전기 뱀장어', elem: 'thunder', r: 1.21, w: 14.9 }, { name: '강철 코뿔', elem: 'stone', r: 1.075, w: 30.5 }, { name: '자석 고양이', elem: 'thunder', r: 1.0, w: 47.2 }],
        B: [{ name: '전기 다람', elem: 'thunder', r: 2.0, w: 1.7 }, { name: '톱니 거북', elem: 'stone', r: 1.55, w: 5.8 }, { name: '번개 새', elem: 'thunder', r: 1.28, w: 14.6 }, { name: '구리 개구리', elem: 'gold', r: 1.1, w: 30.2 }, { name: '전선 뱀', elem: 'thunder', r: 1.0, w: 47.7 }],
        C: [{ name: '찌릿 쥐', elem: 'thunder', r: 1.333, w: 1.4 }, { name: '볼트 벌레', elem: 'stone', r: 1.183, w: 5.9 }, { name: '자석 게', elem: 'stone', r: 1.093, w: 15.5 }, { name: '전구 해파리', elem: 'thunder', r: 1.033, w: 31.0 }, { name: '구리 고슴', elem: 'gold', r: 1.0, w: 46.2 }],
        D: [{ name: '건전지', elem: 'thunder', r: 1.25, w: 1.3 }, { name: '구리 동전', elem: 'gold', r: 1.137, w: 5.9 }, { name: '스파크', elem: 'thunder', r: 1.07, w: 15.6 }, { name: '강철 볼', elem: 'stone', r: 1.025, w: 31.1 }, { name: '전선 벌레', elem: 'thunder', r: 1.0, w: 46.1 }],
        E: [{ name: '작은 나사', elem: 'stone', r: 2.0, w: 1.7 }, { name: '정전기', elem: 'thunder', r: 1.55, w: 5.8 }, { name: '구리 조각', elem: 'gold', r: 1.28, w: 14.6 }, { name: '쇠구슬', elem: 'stone', r: 1.1, w: 30.2 }, { name: '번개 씨앗', elem: 'thunder', r: 1.0, w: 47.7 }],
        F: [{ name: '전기 점', elem: 'thunder', r: 1.5, w: 1.5 }, { name: '쇳가루', elem: 'stone', r: 1.275, w: 5.8 }, { name: '작은 볼트', elem: 'stone', r: 1.14, w: 15.2 }, { name: '구리 실', elem: 'gold', r: 1.05, w: 30.8 }, { name: '불꽃 튀김', elem: 'thunder', r: 1.0, w: 46.7 }],
      } },
      100000: { name: '황금 보물고', cards: {
        S: [{ name: '황금의 용제', elem: 'gold', r: 2.0, w: 1.7 }, { name: '보석 공작왕', elem: 'rainbow', r: 1.55, w: 5.8 }, { name: '다이아 사자왕', elem: 'diamond', r: 1.28, w: 14.6 }, { name: '루비 불사조왕', elem: 'ruby', r: 1.1, w: 30.2 }, { name: '왕관 거북신', elem: 'gold', r: 1.0, w: 47.7 }],
        A: [{ name: '황금 여우', elem: 'gold', r: 1.75, w: 1.6 }, { name: '보석 도마뱀', elem: 'ruby', r: 1.413, w: 5.8 }, { name: '왕관 펭귄', elem: 'gold', r: 1.21, w: 14.9 }, { name: '진주 백조', elem: 'diamond', r: 1.075, w: 30.5 }, { name: '에메랄드 뱀', elem: 'clover', r: 1.0, w: 47.2 }],
        B: [{ name: '금화 두꺼비', elem: 'gold', r: 2.0, w: 1.7 }, { name: '보석 고양이', elem: 'ruby', r: 1.55, w: 5.8 }, { name: '황금 앵무', elem: 'gold', r: 1.28, w: 14.6 }, { name: '사파이어 물고기', elem: 'sapphire', r: 1.1, w: 30.2 }, { name: '왕관 생쥐', elem: 'gold', r: 1.0, w: 47.7 }],
        C: [{ name: '금화', elem: 'gold', r: 1.333, w: 1.4 }, { name: '보석 상자', elem: 'ruby', r: 1.183, w: 5.9 }, { name: '금 거북', elem: 'gold', r: 1.093, w: 15.5 }, { name: '진주 조개', elem: 'diamond', r: 1.033, w: 31.0 }, { name: '반지 뱀', elem: 'gold', r: 1.0, w: 46.2 }],
        D: [{ name: '금 조각', elem: 'gold', r: 1.25, w: 1.3 }, { name: '은화', elem: 'diamond', r: 1.137, w: 5.9 }, { name: '작은 루비', elem: 'ruby', r: 1.07, w: 15.6 }, { name: '목걸이 벌레', elem: 'gold', r: 1.025, w: 31.1 }, { name: '금박 나비', elem: 'gold', r: 1.0, w: 46.1 }],
        E: [{ name: '금가루', elem: 'gold', r: 2.0, w: 1.7 }, { name: '구슬', elem: 'rainbow', r: 1.55, w: 5.8 }, { name: '동전 쥐', elem: 'gold', r: 1.28, w: 14.6 }, { name: '작은 진주', elem: 'diamond', r: 1.1, w: 30.2 }, { name: '리본', elem: 'ruby', r: 1.0, w: 47.7 }],
        F: [{ name: '반짝이', elem: 'gold', r: 1.5, w: 1.5 }, { name: '금실', elem: 'gold', r: 1.275, w: 5.8 }, { name: '구슬 알', elem: 'rainbow', r: 1.14, w: 15.2 }, { name: '은가루', elem: 'diamond', r: 1.05, w: 30.8 }, { name: '동전 조각', elem: 'gold', r: 1.0, w: 46.7 }],
      } },
      200000: { name: '심연', cards: {
        S: [{ name: '심연의 별고래', elem: 'void', r: 2.0, w: 1.7 }, { name: '흑요의 마룡', elem: 'obsidian', r: 1.55, w: 5.8 }, { name: '그림자 기린', elem: 'void', r: 1.28, w: 14.6 }, { name: '달의 여신 토끼', elem: 'diamond', r: 1.1, w: 30.2 }, { name: '혜성 불사조', elem: 'rainbow', r: 1.0, w: 47.7 }],
        A: [{ name: '그림자 늑대', elem: 'void', r: 1.75, w: 1.6 }, { name: '별빛 해파리', elem: 'void', r: 1.413, w: 5.8 }, { name: '흑요 박쥐왕', elem: 'obsidian', r: 1.21, w: 14.9 }, { name: '유령 여우', elem: 'void', r: 1.075, w: 30.5 }, { name: '심해 아귀', elem: 'void', r: 1.0, w: 47.2 }],
        B: [{ name: '그림자 고양이', elem: 'void', r: 2.0, w: 1.7 }, { name: '성운 토끼', elem: 'void', r: 1.55, w: 5.8 }, { name: '흑요 뱀', elem: 'obsidian', r: 1.28, w: 14.6 }, { name: '달빛 나방', elem: 'diamond', r: 1.1, w: 30.2 }, { name: '심연 오징어', elem: 'void', r: 1.0, w: 47.7 }],
        C: [{ name: '별똥 방울', elem: 'thunder', r: 1.333, w: 1.4 }, { name: '그림자 쥐', elem: 'void', r: 1.183, w: 5.9 }, { name: '유령 버섯', elem: 'void', r: 1.093, w: 15.5 }, { name: '어둠 박쥐', elem: 'void', r: 1.033, w: 31.0 }, { name: '흑요 조개', elem: 'obsidian', r: 1.0, w: 46.2 }],
        D: [{ name: '어둠 방울', elem: 'void', r: 1.25, w: 1.3 }, { name: '별 조각', elem: 'thunder', r: 1.137, w: 5.9 }, { name: '그림자 벌레', elem: 'void', r: 1.07, w: 15.6 }, { name: '흑요 알', elem: 'obsidian', r: 1.025, w: 31.1 }, { name: '유령불', elem: 'sapphire', r: 1.0, w: 46.1 }],
        E: [{ name: '작은 그림자', elem: 'void', r: 2.0, w: 1.7 }, { name: '별가루', elem: 'thunder', r: 1.55, w: 5.8 }, { name: '어둠 이끼', elem: 'void', r: 1.28, w: 14.6 }, { name: '검은 돌', elem: 'obsidian', r: 1.1, w: 30.2 }, { name: '달빛 방울', elem: 'diamond', r: 1.0, w: 47.7 }],
        F: [{ name: '어둠 점', elem: 'void', r: 1.5, w: 1.5 }, { name: '별 티끌', elem: 'thunder', r: 1.275, w: 5.8 }, { name: '그림자 실', elem: 'void', r: 1.14, w: 15.2 }, { name: '검은 모래', elem: 'obsidian', r: 1.05, w: 30.8 }, { name: '희미한 빛', elem: 'diamond', r: 1.0, w: 46.7 }],
      } },
      300000: { name: '하늘 신전', cards: {
        S: [{ name: '천공의 성룡', elem: 'rainbow', r: 2.0, w: 1.7 }, { name: '태양 불사조', elem: 'gold', r: 1.55, w: 5.8 }, { name: '무지개 천마', elem: 'rainbow', r: 1.28, w: 14.6 }, { name: '구름 고래신', elem: 'diamond', r: 1.1, w: 30.2 }, { name: '별의 기린', elem: 'rainbow', r: 1.0, w: 47.7 }],
        A: [{ name: '천사 고양이', elem: 'diamond', r: 1.75, w: 1.6 }, { name: '구름 양', elem: 'diamond', r: 1.413, w: 5.8 }, { name: '무지개 새', elem: 'rainbow', r: 1.21, w: 14.9 }, { name: '태양 사자', elem: 'gold', r: 1.075, w: 30.5 }, { name: '하늘 고래', elem: 'sapphire', r: 1.0, w: 47.2 }],
        B: [{ name: '구름 강아지', elem: 'diamond', r: 2.0, w: 1.7 }, { name: '바람 여우', elem: 'sapphire', r: 1.55, w: 5.8 }, { name: '빛의 나비', elem: 'gold', r: 1.28, w: 14.6 }, { name: '천둥 양', elem: 'thunder', r: 1.1, w: 30.2 }, { name: '무지개 물고기', elem: 'rainbow', r: 1.0, w: 47.7 }],
        C: [{ name: '구름 토끼', elem: 'diamond', r: 1.333, w: 1.4 }, { name: '깃털 새', elem: 'diamond', r: 1.183, w: 5.9 }, { name: '햇살 방울', elem: 'gold', r: 1.093, w: 15.5 }, { name: '바람개비 다람', elem: 'sapphire', r: 1.033, w: 31.0 }, { name: '무지개 달팽', elem: 'rainbow', r: 1.0, w: 46.2 }],
        D: [{ name: '구름 조각', elem: 'diamond', r: 1.25, w: 1.3 }, { name: '깃털', elem: 'diamond', r: 1.137, w: 5.9 }, { name: '햇살 씨앗', elem: 'gold', r: 1.07, w: 15.6 }, { name: '바람 방울', elem: 'sapphire', r: 1.025, w: 31.1 }, { name: '무지개 방울', elem: 'rainbow', r: 1.0, w: 46.1 }],
        E: [{ name: '작은 구름', elem: 'diamond', r: 2.0, w: 1.7 }, { name: '빛 알갱이', elem: 'gold', r: 1.55, w: 5.8 }, { name: '솜털', elem: 'diamond', r: 1.28, w: 14.6 }, { name: '바람 씨', elem: 'sapphire', r: 1.1, w: 30.2 }, { name: '무지개 가루', elem: 'rainbow', r: 1.0, w: 47.7 }],
        F: [{ name: '구름 티끌', elem: 'diamond', r: 1.5, w: 1.5 }, { name: '빛 점', elem: 'gold', r: 1.275, w: 5.8 }, { name: '바람 실', elem: 'sapphire', r: 1.14, w: 15.2 }, { name: '깃털 조각', elem: 'diamond', r: 1.05, w: 30.8 }, { name: '무지개 점', elem: 'rainbow', r: 1.0, w: 46.7 }],
      } },
    },
    G_CARDS: [{ name: '꼬마돌', elem: 'stone', r: 2.0, w: 1.7 }, { name: '흙두지', elem: 'stone', r: 1.55, w: 5.8 }, { name: '잎새벌레', elem: 'clover', r: 1.28, w: 14.6 }, { name: '물방울링', elem: 'sapphire', r: 1.1, w: 30.2 }, { name: '이끼달팽', elem: 'clover', r: 1.0, w: 47.7 }]
  };
  CARDS.cardImg = c => (c.grade === 'G' ? `assets/cards/G/${c.idx | 0}.jpg` : `assets/cards/${c.tier}/${c.grade}${c.idx | 0}.jpg`);
  CARDS.cardKey = c => (c.grade === 'G' ? `G:${c.idx | 0}` : `${c.tier}:${c.grade}:${c.idx | 0}`);
  CARDS.allCards = () => {
    const out = [];
    for (const t of Object.keys(CARDS.TIERS)) for (const g of 'SABCDEF'.split('')) (CARDS.TIERS[t].cards[g] || []).forEach((c, idx) => out.push({ ...c, tier: t, grade: g, idx }));
    CARDS.G_CARDS.forEach((c, idx) => out.push({ ...c, tier: 'G', grade: 'G', idx }));
    return out;
  };
  root.CARDS = CARDS;
})(typeof window !== 'undefined' ? window : globalThis);

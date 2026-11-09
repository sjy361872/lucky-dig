# 곡괭이 키우기 (베타)

곡괭이가 자동으로 몬스터를 캐고, 8번 때릴 때마다 **광맥 탐지**가 돌아 큰 한 방이 터지는 방치형 웹게임.

- 플레이: https://sjy361872.github.io/lucky-dig/beta2/
- 실행(로컬): 폴더에서 `python -m http.server 8765` → http://localhost:8765/

## 규칙 한눈에
- 광석은 피해 더하기 (🪨 돌 · 💎 보석 · ⭐ 황금), 💣 TNT는 하나마다 전체 ×2
- ⭐ 황금 3개 이상 = **황금 광맥**: 피해 ×10 + 다음 몬스터들을 보스 앞까지 관통
- 보스전: 좋은 칸을 고정하고, 준비 3번을 다시 탐지·수리에 나눠 씀

## 파일
| 파일 | 역할 |
|---|---|
| `index.html` | 화면 뼈대 |
| `js/idle.js` | 엔진 (계산만, 화면과 무관) |
| `js/idle_ui.js` | 화면·연출·저장 |
| `js/cards.js` | 몬스터 카드 목록 |
| `js/sound.js` | 효과음·배경음 |
| `js/online-config.js` | 랭킹 서버 설정 |
| `css/idle.css` | 스타일 |
| `assets/` | 그림 (mobs·cards: 몬스터 / picks: 곡괭이 / blocks·items·syms: 탐지 그림 / ui: 배경·아이콘) |

> `main` 브랜치는 이전 게임 "럭키 디그"입니다.

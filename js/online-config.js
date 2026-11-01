// =====================================================
//  온라인 랭킹 설정
//  - 비워 두면 "오프라인 모드": 랭킹·기록이 이 기기에만 저장됩니다.
//  - Supabase 프로젝트를 만든 뒤 URL과 anon key를 넣으면 온라인 모드로 바뀝니다.
//    (테이블은 tools/supabase_schema.sql 을 Supabase SQL Editor에서 한 번 실행)
// =====================================================
//  ※ app 브랜치(탐험 버전 개발 중): 기존 게임(main) 계정 기록과 섞이지 않도록 오프라인으로 둠.
//    온라인은 M4(오늘의 광맥)·M6(서버 정리)에서 별도 테이블로 다시 연결
window.ONLINE = {
  SUPABASE_URL: '', // 'https://kusmwxkexpghfshnmiyi.supabase.co'
  SUPABASE_ANON_KEY: 'sb_publishable_LQYU-e4_o9_bTBlRh_jooA_MsyQhiHx', // 공개용(publishable) 키
};

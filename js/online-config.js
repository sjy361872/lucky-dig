// =====================================================
//  온라인 랭킹 설정
//  - 비워 두면 "오프라인 모드": 랭킹·기록이 이 기기에만 저장됩니다.
//  - Supabase 프로젝트를 만든 뒤 URL과 anon key를 넣으면 온라인 모드로 바뀝니다.
//    (테이블은 tools/supabase_schema.sql 을 Supabase SQL Editor에서 한 번 실행)
// =====================================================
window.ONLINE = {
  SUPABASE_URL: 'https://kusmwxkexpghfshnmiyi.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_LQYU-e4_o9_bTBlRh_jooA_MsyQhiHx', // 공개용(publishable) 키
};

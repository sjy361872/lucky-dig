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
// 리디자인 시험 중: 내 컴퓨터(localhost)에서 열면 진짜 랭킹 서버에 기록하지 않음
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:' || /\/v2\//.test(location.pathname)) window.ONLINE = {};

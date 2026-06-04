-- ════════════════════════════════════════════════════════════════
-- 0007_board_activity_insert.sql — FR-09 활동 이력 INSERT 정책
-- 0003 은 SELECT 정책만 두고 INSERT 는 service_role(웹훅) 전용으로 남겼다.
-- 카드 액션은 user 클라이언트로 돌므로, 멤버가 카드 변경 활동을 직접 기록하려면
-- INSERT 정책이 필요하다. 쓰기 권한자(owner/admin/member)만 허용 — guest 제외.
-- board_workspace 헬퍼(0002)로 board → workspace 매핑.
-- ════════════════════════════════════════════════════════════════

create policy "board_activity_insert" on public.board_activity
  for insert with check (
    public.workspace_role(public.board_workspace(board_id))
      in ('owner','admin','member')
  );

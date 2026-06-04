-- ════════════════════════════════════════════════════════════════
-- 0005_comment_label_mutations.sql
-- FR-08 댓글 수정/삭제: comments 본인 update 정책 추가.
--   (delete own 정책은 0002 에 이미 존재, insert/select 도 0002 에 있음.)
-- FR-07 레이블 붙이기/떼기: labels / card_labels write 정책은 0002 에
--   이미 member 이상 전체(for all)로 존재 → 추가 정책 불필요.
-- ════════════════════════════════════════════════════════════════

-- 본인이 작성한 댓글만 내용 수정 가능. USING(행 선택) + WITH CHECK(author_id
-- 변경 차단) 양쪽 모두 author_id = auth.uid() 로 잠근다.
create policy "comments update own" on public.comments
  for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

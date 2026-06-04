import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/shared/config/env";
import {
  extractCardIds,
  verifySignature,
} from "@/shared/lib/github-signature";
import { createAdminClient } from "@/shared/api/supabase/admin";
import {
  resolvePrTransition,
  pickTargetColumn,
  prBadgeState,
} from "@/features/pr-automation/model/transition";
import {
  appendWithRetry,
  UNIQUE_VIOLATION,
} from "@/features/pr-automation/model/append-position";

export const runtime = "nodejs";

/**
 * 명세 6.4 / 8.1: GitHub Webhook 수신.
 * 검증 → board_id 식별 → github_events 적재 → 이벤트별 처리 → processed_at.
 */
export async function POST(request: NextRequest) {
  const secret = serverEnv().GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "GITHUB_WEBHOOK_SECRET 미설정" },
      { status: 503 },
    );
  }

  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(raw, secret, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") ?? "unknown";
  const payload = JSON.parse(raw) as {
    repository?: { full_name?: string };
    commits?: { message: string; url: string }[];
    pull_request?: {
      body?: string | null;
      html_url: string;
      state: string;
      number?: number;
      merged?: boolean;
    };
    issue?: { title: string; body?: string | null; html_url: string };
    action?: string;
  };

  const repo = payload.repository?.full_name;
  if (!repo) {
    return NextResponse.json({ error: "no repository" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: board } = await admin
    .from("boards")
    .select(
      "id, pr_automation_enabled, pr_open_column_id, pr_merged_column_id",
    )
    .eq("github_repo", repo)
    .maybeSingle();
  if (!board) {
    return NextResponse.json({ ok: true, skipped: "repo not linked" });
  }

  // 멱등 키: GitHub 의 at-least-once 재전송(자동 retry/UI Redeliver)은 동일
  // X-GitHub-Delivery 를 유지한다. 이미 처리된 delivery 면 early-return 하여
  // 활동로그 중복·수동 이동 되돌림을 막는다.
  const delivery = request.headers.get("x-github-delivery");
  if (delivery) {
    const { data: dup } = await admin
      .from("github_events")
      .select("id")
      .eq("delivery_id", delivery)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({ ok: true, skipped: "duplicate delivery" });
    }
  }

  const { data: eventRow, error: insertError } = await admin
    .from("github_events")
    .insert({
      board_id: board.id,
      event_type: event,
      payload,
      delivery_id: delivery,
    })
    .select("id")
    .single();
  if (insertError) {
    // 동시 동일 delivery 경합 → unique 위반도 중복으로 처리 (위 SELECT 백스톱).
    if (insertError.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ ok: true, skipped: "duplicate delivery" });
    }
    return NextResponse.json(
      { ok: false, error: insertError.message },
      { status: 500 },
    );
  }

  // 이벤트별 처리 (명세 8.1)
  try {
    if (event === "push" && payload.commits?.length) {
      for (const commit of payload.commits) {
        for (const cardRef of extractCardIds(commit.message)) {
          await admin
            .from("cards")
            .update({ github_url: commit.url })
            .ilike("title", `%${cardRef}%`);
        }
      }
    } else if (event === "pull_request" && payload.pull_request) {
      for (const cardRef of extractCardIds(payload.pull_request.body ?? "")) {
        await admin
          .from("cards")
          .update({ github_url: payload.pull_request.html_url })
          .ilike("title", `%${cardRef}%`);
      }
    }

    // PR 자동화: github_url 로 링크된 카드를 매핑 컬럼으로 이동 + 상태 배지 + 활동 로그.
    // 라이프사이클 액션(opened/reopened/closed)만 처리 — synchronize/labeled 등 잡음
    // 이벤트가 머지된 카드 배지를 'open' 으로 되돌리는 회귀를 방지한다.
    if (
      event === "pull_request" &&
      payload.pull_request &&
      (payload.action === "opened" ||
        payload.action === "reopened" ||
        payload.action === "closed")
    ) {
      const pr = payload.pull_request;
      const action = payload.action ?? "";
      const merged = pr.merged === true;
      const badge = prBadgeState(action, merged);
      const transition = resolvePrTransition(action, merged);

      // 이 보드의 컬럼(이름 포함) — 매칭 범위 한정 + 활동 메시지용 이름
      const { data: boardCols } = await admin
        .from("columns")
        .select("id, name")
        .eq("board_id", board.id);
      const colIds = (boardCols ?? []).map(
        (c: { id: string; name: string }) => c.id,
      );

      const { data: linkedCards } = colIds.length
        ? await admin
            .from("cards")
            .select("id, title, column_id")
            .eq("github_url", pr.html_url)
            .in("column_id", colIds)
        : { data: [] as { id: string; title: string; column_id: string }[] };

      const targetColId = pickTargetColumn(board, transition);

      for (const card of linkedCards ?? []) {
        if (!targetColId || card.column_id === targetColId) {
          // 이동 없음 → 배지만 갱신 (경합·활동로그 없음).
          await admin.rpc("apply_pr_card_move", {
            p_card_id: card.id,
            p_pr_state: badge,
          });
          continue;
        }

        const movedToName =
          (boardCols ?? []).find(
            (c: { id: string; name: string }) => c.id === targetColId,
          )?.name ?? null;
        const verb = transition === "done" ? "머지됨" : "열림";
        const activityMessage = movedToName
          ? `🤖 PR #${pr.number ?? "?"} ${verb} → '${card.title}'을(를) ${movedToName}(으)로 이동`
          : null;

        // 동시 append 충돌(같은 컬럼 끝 동시 추가)을 unique 위반으로 감지하고
        // lastPos 재조회 + 재계산으로 재시도. cards.update + 활동로그는 RPC 한
        // 트랜잭션으로 묶여 부분 실패가 없다.
        await appendWithRetry(
          async () => {
            const { data: lastCard } = await admin
              .from("cards")
              .select("position")
              .eq("column_id", targetColId)
              .order("position", { ascending: false })
              .limit(1)
              .maybeSingle();
            return lastCard?.position ?? null;
          },
          async (position) => {
            const { data, error } = await admin.rpc("apply_pr_card_move", {
              p_card_id: card.id,
              p_pr_state: badge,
              p_target_column_id: targetColId,
              p_position: position,
              p_board_id: board.id,
              p_activity_message: activityMessage,
            });
            if (error) throw new Error(error.message);
            // RPC 가 동시 append 충돌을 'conflict' 로 직접 신호한다(SQLSTATE 표면화 비의존).
            return { conflict: data === "conflict" };
          },
        );
      }
    }
    // issues → 새 카드 자동 생성은 보드 옵션(기본 OFF, 명세 8.1) — 적재만 수행.

    if (eventRow) {
      await admin
        .from("github_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", eventRow.id);
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "처리 실패" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, event, board: board.id });
}

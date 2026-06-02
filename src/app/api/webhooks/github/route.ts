import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/shared/config/env";
import {
  extractCardIds,
  verifySignature,
} from "@/shared/lib/github-signature";
import { createAdminClient } from "@/shared/api/supabase/admin";
import { between } from "@/shared/lib/lexorank";
import {
  resolvePrTransition,
  pickTargetColumn,
  prBadgeState,
} from "@/features/pr-automation/model/transition";

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

  const { data: eventRow } = await admin
    .from("github_events")
    .insert({ board_id: board.id, event_type: event, payload })
    .select("id")
    .single();

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
        const update: {
          github_pr_state: string;
          column_id?: string;
          position?: string;
        } = {
          github_pr_state: badge,
        };
        let movedToName: string | null = null;

        if (targetColId && card.column_id !== targetColId) {
          const { data: lastCard } = await admin
            .from("cards")
            .select("position")
            .eq("column_id", targetColId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();
          update.column_id = targetColId;
          update.position = between(lastCard?.position ?? null, null);
          movedToName =
            (boardCols ?? []).find(
              (c: { id: string; name: string }) => c.id === targetColId,
            )?.name ?? null;
        }

        await admin.from("cards").update(update).eq("id", card.id);

        if (movedToName) {
          const verb = transition === "done" ? "머지됨" : "열림";
          await admin.from("board_activity").insert({
            board_id: board.id,
            card_id: card.id,
            kind: "pr_automation",
            message: `🤖 PR #${pr.number ?? "?"} ${verb} → '${card.title}'을(를) ${movedToName}(으)로 이동`,
          });
        }
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

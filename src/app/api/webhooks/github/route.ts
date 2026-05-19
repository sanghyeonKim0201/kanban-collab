import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/shared/config/env";
import {
  extractCardIds,
  verifySignature,
} from "@/shared/lib/github-signature";
import { createAdminClient } from "@/shared/api/supabase/admin";

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
    pull_request?: { body?: string | null; html_url: string; state: string };
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
    .select("id")
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

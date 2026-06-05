"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { inviteMember } from "@/entities/workspace/api/actions";
import { ASSIGNABLE_ROLES } from "@/entities/workspace/model/member-permissions";
import type { Role } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

/** owner/admin 전용 멤버 초대 폼 — 이메일 + 역할 선택. */
export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    const value = email.trim();
    if (!value) return;
    start(async () => {
      try {
        await inviteMember(workspaceId, value, role);
        toast.success("멤버를 추가했습니다");
        setEmail("");
        setRole("member");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "초대에 실패했습니다");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3 sm:flex-row sm:items-center">
      <Input
        type="email"
        value={email}
        placeholder="가입된 사용자 이메일"
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        className="flex-1"
        aria-label="초대할 사용자 이메일"
      />
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger aria-label="역할" className="sm:w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASSIGNABLE_ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={submit} disabled={pending || !email.trim()}>
        <UserPlus className="h-4 w-4" />
        {pending ? "추가 중…" : "초대"}
      </Button>
    </div>
  );
}

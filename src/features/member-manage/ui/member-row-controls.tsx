"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  changeMemberRole,
  removeMember,
} from "@/entities/workspace/api/actions";
import { ASSIGNABLE_ROLES } from "@/entities/workspace/model/member-permissions";
import type { Role } from "@/shared/types/database";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

/**
 * 멤버 한 행의 관리 컨트롤(owner/admin 에게만 렌더).
 * - 역할 변경 Select: owner 항목은 부여 불가(목록에 없음). 단, 대상이 이미 owner 면
 *   현재값 표시를 위해 owner 옵션을 함께 노출하되 마지막 owner 면 비활성.
 * - 제거 버튼: 자기 자신·마지막 owner 는 비활성.
 */
export function MemberRowControls({
  workspaceId,
  userId,
  currentRole,
  isSelf,
  isLastOwner,
}: {
  workspaceId: string;
  userId: string;
  currentRole: Role;
  isSelf: boolean;
  isLastOwner: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  // owner 가 현재 역할이면 Select 에 owner 옵션을 포함(표시용). 그 외는 부여 가능 역할만.
  const roleOptions: Role[] =
    currentRole === "owner"
      ? (["owner", ...ASSIGNABLE_ROLES] as Role[])
      : ASSIGNABLE_ROLES;

  // 마지막 owner 의 역할 변경은 막는다(강등 방지). Select 전체 비활성.
  const roleSelectDisabled = pending || isLastOwner;

  function onRoleChange(next: string) {
    const nextRole = next as Role;
    if (nextRole === currentRole) return;
    if (nextRole === "owner") return; // owner 부여는 비허용 — 무시.
    start(async () => {
      try {
        await changeMemberRole(workspaceId, userId, nextRole);
        toast.success("역할을 변경했습니다");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "역할 변경 실패");
      }
    });
  }

  function onRemove() {
    if (
      !window.confirm("이 멤버를 워크스페이스에서 제거하시겠습니까?")
    ) {
      return;
    }
    start(async () => {
      try {
        await removeMember(workspaceId, userId);
        toast.success("멤버를 제거했습니다");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "멤버 제거 실패");
      }
    });
  }

  const removeDisabled = pending || isSelf || isLastOwner;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentRole}
        onValueChange={onRoleChange}
        disabled={roleSelectDisabled}
      >
        <SelectTrigger aria-label="역할 변경" className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roleOptions.map((r) => (
            <SelectItem key={r} value={r} disabled={r === "owner"}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        disabled={removeDisabled}
        aria-label="멤버 제거"
        title={
          isSelf
            ? "자기 자신은 제거할 수 없습니다"
            : isLastOwner
              ? "마지막 소유자는 제거할 수 없습니다"
              : "멤버 제거"
        }
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

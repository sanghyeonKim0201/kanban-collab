# UI 리디자인 (다크 Linear 풍) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kanban Collab 의 비주얼 레이어를 전면 폐기하고, 애널리틱스 대시보드 레퍼런스의 배치를 다크 Linear 풍으로 재구성한다 (로직/스키마/라우트 0 변경).

**Architecture:** Radix 동작 레이어와 모든 비즈니스 로직은 유지하고, 디자인 토큰 → `shared/ui` 프리미티브 → 2단 좌측 내비 쉘 → 화면별 레이아웃 순으로 비주얼만 교체한다. 스탯/차트는 기존 데이터로부터 계산하는 순수 헬퍼(+단위 테스트)와 무의존 SVG 스파크라인으로 채운다.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind v3, Radix UI, dnd-kit, next/font(Inter), vitest. 신규 의존성: `@radix-ui/react-tabs`, `@radix-ui/react-switch`.

---

## 제약 (전 태스크 공통)

- **로직 0 변경:** `entities/*/api`, `entities/*/model`(신규 순수 헬퍼 파일 추가는 예외), 서버액션, 라우트, dnd 계산(LexoRank), 실시간/presence, DB 스키마/RLS 를 건드리지 않는다.
- **허용:** 화면 표시용 순수 계산 헬퍼 + 읽기 전용 집계 쿼리 추가, 컴포넌트 className/JSX/레이아웃 교체, 신규 `shared/ui` 프리미티브, 신규 의존성 2개.
- **기존 테스트 불변:** `tests/unit/*`(lexorank, move-card, ai-parse, github-signature)는 수정 없이 계속 green 이어야 한다. 각 태스크 끝에서 `pnpm test` 로 확인.
- **검증 루틴:** 비주얼 태스크는 매번 `pnpm typecheck` → `pnpm lint` → 필요 시 `pnpm test` → dev 프리뷰 스크린샷으로 확인 후 커밋.

## File Structure (생성 / 수정)

**토큰·폰트**
- Modify `src/app/globals.css` — 다크 단일 토큰
- Modify `tailwind.config.ts` — surface/semantic/font/shadow 확장
- Modify `src/app/layout.tsx` — Inter 폰트, `dark` 고정
- Modify `src/app/providers.tsx` — next-themes `forcedTheme="dark"`

**shared/ui (재스타일)**
- Modify `src/shared/ui/{button,card,badge,input,textarea,label,avatar,dialog,dropdown-menu}.tsx`

**shared/ui (신규)**
- Create `src/shared/lib/sparkline-path.ts` (+ test)
- Create `src/shared/ui/sparkline.tsx`
- Create `src/shared/ui/status-pill.tsx`
- Create `src/shared/ui/progress-bar.tsx`
- Create `src/shared/ui/segmented-control.tsx`
- Create `src/shared/ui/empty-state.tsx`
- Create `src/shared/ui/tabs.tsx` (Radix Tabs)
- Create `src/shared/ui/switch.tsx` (Radix Switch)
- Create `src/shared/ui/slide-over.tsx` (Radix Dialog 우측 변형)
- Create `src/shared/ui/stat-card.tsx`

**집계 (순수 헬퍼 + 쿼리)**
- Create `src/entities/board/model/stats.ts` (+ test) — 순수 계산
- Create `src/entities/board/api/stats.ts` — 읽기 전용 쿼리 (얇은 래퍼)

**쉘 & 위젯**
- Create `src/widgets/app-shell/ui/icon-rail.tsx`
- Create `src/widgets/app-shell/ui/work-pane.tsx`
- Modify `src/widgets/app-shell/ui/app-shell.tsx`
- Create `src/widgets/board-view/ui/board-toolbar.tsx`
- Create `src/widgets/board-view/ui/board-context-panel.tsx`
- Create `src/widgets/board-view/ui/board-list-view.tsx`
- Modify `src/widgets/board-view/ui/{board-view,board-column,card-item}.tsx`
- Modify `src/widgets/card-detail-panel/ui/{card-modal,card-detail}.tsx`
- Modify `src/widgets/meeting-panel/ui/meeting-detail.tsx`
- Modify `src/widgets/presence-cursors/ui/presence-cursors.tsx`

**화면**
- Modify `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/features/auth-sign-in/ui/auth-form.tsx`
- Modify `src/app/(main)/workspaces/page.tsx`, `src/app/(main)/workspaces/[id]/page.tsx`
- Modify `src/app/(main)/meetings/page.tsx`, `src/app/(main)/meetings/[meetingId]/page.tsx`
- Modify `src/app/(main)/settings/page.tsx`
- Modify `src/features/{card-create,board-create,workspace-create,github-link-card,meeting-record,meeting-to-cards,ai-classify-card}/ui/*.tsx`

---

## Phase 0 — 토큰 & 폰트 기반

### Task 1: 다크 단일 디자인 토큰 + Inter 폰트

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts:12-47` (colors/extend)
- Modify: `src/app/layout.tsx`
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: `globals.css` 를 다크 단일 토큰으로 교체**

`:root` 한 블록만 두고 `.dark` 분기는 삭제 (단일 테마). 기존 컴포넌트가 쓰는 모든 토큰명(card/popover/secondary/accent/muted/destructive/primary/border/input/ring)을 유지하고 surface/semantic 을 추가:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 240 6% 6%;
    --foreground: 240 10% 96%;
    --surface: 240 5% 9%;
    --surface-2: 240 5% 11%;
    --card: 240 5% 9%;
    --card-foreground: 240 10% 96%;
    --popover: 240 5% 11%;
    --popover-foreground: 240 10% 96%;
    --primary: 231 56% 60%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 5% 14%;
    --secondary-foreground: 240 10% 96%;
    --muted: 240 4% 14%;
    --muted-foreground: 240 5% 64%;
    --accent: 240 5% 14%;
    --accent-foreground: 240 10% 96%;
    --destructive: 0 72% 55%;
    --destructive-foreground: 0 0% 100%;
    --success: 152 55% 48%;
    --warning: 38 92% 56%;
    --border: 240 5% 16%;
    --border-strong: 240 5% 22%;
    --input: 240 5% 16%;
    --ring: 231 56% 64%;
    --radius: 0.625rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  html {
    color-scheme: dark;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "cv11", "ss01", "tnum";
  }
}
```

- [ ] **Step 2: `tailwind.config.ts` 의 colors/extend 에 신규 토큰 + 폰트 + 섀도 추가**

기존 `colors` 객체(라인 13-47)에 다음 키를 추가하고, `extend` 에 `fontFamily`/`boxShadow` 추가:

```ts
// colors 안에 추가
surface: "hsl(var(--surface))",
"surface-2": "hsl(var(--surface-2))",
"border-strong": "hsl(var(--border-strong))",
success: "hsl(var(--success))",
warning: "hsl(var(--warning))",
// extend 안에 추가
fontFamily: {
  sans: ["var(--font-inter)", "system-ui", "sans-serif"],
},
boxShadow: {
  card: "0 1px 2px rgba(0,0,0,0.4)",
  elevated: "0 8px 30px rgba(0,0,0,0.5)",
  glow: "0 0 0 1px hsl(var(--ring) / 0.4)",
},
```

- [ ] **Step 3: `layout.tsx` 에 Inter 폰트 + `dark` 클래스 고정**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Kanban Collab",
  description: "실시간 협업 칸반 기반 프로젝트 관리 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <Toaster position="top-right" theme="dark" richColors />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: `providers.tsx` 를 다크 강제로**

`ThemeProvider` 의 props 를 `attribute="class" forcedTheme="dark"` 로 교체하고 `enableSystem`/`defaultTheme` 제거:

```tsx
<ThemeProvider attribute="class" forcedTheme="dark">
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
</ThemeProvider>
```

- [ ] **Step 5: 타입·린트·기존 테스트 확인**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 통과 (기존 4개 단위 테스트 green 유지).

- [ ] **Step 6: dev 프리뷰로 전역 톤 확인**

`preview_start` 후 `/login` 스크린샷. Expected: 딥 다크 배경(#0E0E10), 텍스트 가독(밝은 회백), 콘솔 에러 없음.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css tailwind.config.ts src/app/layout.tsx src/app/providers.tsx
git commit -m "feat(ui): 다크 단일 디자인 토큰 + Inter 폰트 기반"
```

---

## Phase 1 — shared/ui 프리미티브

### Task 2: 기존 shared/ui 프리미티브 재스타일

**Files:**
- Modify: `src/shared/ui/button.tsx:6-30` (cva), `card.tsx`, `badge.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx`, `avatar.tsx`, `dialog.tsx`, `dropdown-menu.tsx`

- [ ] **Step 1: button cva 를 Linear 톤으로 조정**

`buttonVariants` 의 base 와 variant 를 교체 (높이/라운드/포커스 글로우):

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-card",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-surface hover:bg-surface-2 hover:border-border-strong",
        secondary: "bg-surface-2 text-secondary-foreground hover:bg-surface-2/80",
        ghost: "hover:bg-surface-2 text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

- [ ] **Step 2: card / input / textarea / dialog / dropdown 표면·경계 정리**

각 파일에서 컨테이너 표면을 `bg-surface`, 경계를 `border-border`, 라운드 `rounded-xl`(card)·`rounded-lg`(input), 포커스 `focus-visible:ring-2 focus-visible:ring-ring/60` 로 통일. dialog/dropdown content 는 `bg-popover border-border shadow-elevated`. (Radix 구조·동작은 그대로, className 만 교체.)

- [ ] **Step 3: 타입·린트**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 4: 프리뷰 확인**

`/login` 과 `/workspaces`(로그인 후) 스크린샷으로 버튼/카드/입력 톤 확인.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui
git commit -m "feat(ui): shared/ui 프리미티브 다크 Linear 재스타일"
```

### Task 3: 스파크라인 path 순수 헬퍼 (TDD)

**Files:**
- Create: `src/shared/lib/sparkline-path.ts`
- Test: `tests/unit/sparkline-path.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, it, expect } from "vitest";
import { buildSparkline } from "@/shared/lib/sparkline-path";

describe("buildSparkline", () => {
  it("빈 배열이면 빈 path 를 반환", () => {
    const r = buildSparkline([], 100, 30);
    expect(r.line).toBe("");
    expect(r.area).toBe("");
  });

  it("단일 값이면 수평선", () => {
    const r = buildSparkline([5], 100, 30);
    expect(r.line).toContain("M0");
  });

  it("증가 데이터는 우상향 (마지막 점 y가 첫 점 y보다 작음)", () => {
    const r = buildSparkline([0, 10], 100, 30);
    // 좌표: 첫 점 x=0, 마지막 점 x=100. y는 위로 갈수록 작다(SVG).
    const pts = r.points;
    expect(pts[0].x).toBe(0);
    expect(pts[pts.length - 1].x).toBe(100);
    expect(pts[pts.length - 1].y).toBeLessThan(pts[0].y);
  });

  it("area path 는 닫힌 도형 (Z 포함)", () => {
    const r = buildSparkline([1, 2, 3], 100, 30);
    expect(r.area.endsWith("Z")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run tests/unit/sparkline-path.test.ts`
Expected: FAIL ("buildSparkline" 미정의).

- [ ] **Step 3: 구현**

```ts
export interface SparklinePoint {
  x: number;
  y: number;
}
export interface SparklineResult {
  points: SparklinePoint[];
  line: string;
  area: string;
}

/** 데이터를 width×height 박스의 SVG 좌표로 매핑. y는 위가 0(SVG 관례). */
export function buildSparkline(
  data: number[],
  width: number,
  height: number,
  pad = 2,
): SparklineResult {
  if (data.length === 0) return { points: [], line: "", area: "" };

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const innerH = height - pad * 2;
  const step = data.length === 1 ? 0 : width / (data.length - 1);

  const points = data.map((v, i) => ({
    x: data.length === 1 ? 0 : Math.round(i * step),
    y: Math.round(pad + innerH - ((v - min) / span) * innerH),
  }));

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
    .join(" ");
  const area =
    points.length > 0
      ? `${line} L${points[points.length - 1].x} ${height} L${points[0].x} ${height} Z`
      : "";

  return { points, line, area };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run tests/unit/sparkline-path.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/sparkline-path.ts tests/unit/sparkline-path.test.ts
git commit -m "feat(ui): 무의존 스파크라인 path 헬퍼 + 테스트"
```

### Task 4: Sparkline / StatusPill / ProgressBar / SegmentedControl / EmptyState 컴포넌트

**Files:**
- Create: `src/shared/ui/sparkline.tsx`, `status-pill.tsx`, `progress-bar.tsx`, `segmented-control.tsx`, `empty-state.tsx`

- [ ] **Step 1: `sparkline.tsx`**

```tsx
import { buildSparkline } from "@/shared/lib/sparkline-path";
import { cn } from "@/shared/lib/cn";

export function Sparkline({
  data,
  width = 120,
  height = 32,
  className,
  variant = "area",
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  variant?: "area" | "line";
}) {
  const { line, area } = buildSparkline(data, width, height);
  return (
    <svg width={width} height={height} className={cn("overflow-visible", className)}>
      {variant === "area" && area && (
        <path d={area} fill="hsl(var(--primary) / 0.15)" stroke="none" />
      )}
      {line && (
        <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
```

- [ ] **Step 2: `status-pill.tsx`** — 컬러 tint 상태칩 (우선순위/회의상태/컬럼명에 재사용)

```tsx
import { cn } from "@/shared/lib/cn";

const tones = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
} as const;

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
```

- [ ] **Step 3: `progress-bar.tsx`**

```tsx
import { cn } from "@/shared/lib/cn";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

- [ ] **Step 4: `segmented-control.tsx`** — Board/List·Grid/List 토글 (제어 컴포넌트)

```tsx
import { cn } from "@/shared/lib/cn";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-surface-2 text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: `empty-state.tsx`**

```tsx
import { cn } from "@/shared/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center", className)}>
      {icon && <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 6: 타입·린트**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui/sparkline.tsx src/shared/ui/status-pill.tsx src/shared/ui/progress-bar.tsx src/shared/ui/segmented-control.tsx src/shared/ui/empty-state.tsx
git commit -m "feat(ui): sparkline·status-pill·progress·segmented·empty-state 프리미티브"
```

### Task 5: Radix Tabs/Switch/SlideOver + StatCard

**Files:**
- Modify: `package.json` (deps)
- Create: `src/shared/ui/tabs.tsx`, `switch.tsx`, `slide-over.tsx`, `stat-card.tsx`

- [ ] **Step 1: 의존성 추가**

Run: `pnpm add @radix-ui/react-tabs @radix-ui/react-switch`
Expected: package.json 에 두 패키지 추가, 설치 성공.

- [ ] **Step 2: `tabs.tsx`** (shadcn 패턴, 다크 톤)

```tsx
"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/shared/lib/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn("inline-flex h-9 items-center gap-1 border-b border-border", className)} {...props} />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative -mb-px inline-flex items-center whitespace-nowrap border-b-2 border-transparent px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = TabsPrimitive.Content;
```

- [ ] **Step 3: `switch.tsx`** (Radix Switch, accent on)

```tsx
"use client";
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/shared/lib/cn";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
```

- [ ] **Step 4: `slide-over.tsx`** (Radix Dialog 우측 패널 — 카드 상세용)

```tsx
"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export const SlideOver = DialogPrimitive.Root;
export const SlideOverTrigger = DialogPrimitive.Trigger;

export const SlideOverContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-elevated transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SlideOverContent.displayName = "SlideOverContent";

export const SlideOverTitle = DialogPrimitive.Title;
export const SlideOverDescription = DialogPrimitive.Description;
```

- [ ] **Step 5: `stat-card.tsx`** (라벨 + 값 + 옵션 스파크라인)

```tsx
import { cn } from "@/shared/lib/cn";
import { Sparkline } from "./sparkline";

export function StatCard({
  label,
  value,
  series,
  className,
}: {
  label: string;
  value: React.ReactNode;
  series?: number[];
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-3", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums text-foreground">{value}</span>
        {series && series.length > 1 && <Sparkline data={series} width={72} height={28} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 타입·린트**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/ui/tabs.tsx src/shared/ui/switch.tsx src/shared/ui/slide-over.tsx src/shared/ui/stat-card.tsx
git commit -m "feat(ui): Radix tabs·switch·slide-over + stat-card 프리미티브"
```

---

## Phase 2 — 집계 헬퍼

### Task 6: 보드 통계 순수 헬퍼 (TDD) + 읽기 전용 쿼리

**Files:**
- Create: `src/entities/board/model/stats.ts`
- Test: `tests/unit/board-stats.test.ts`
- Create: `src/entities/board/api/stats.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, it, expect } from "vitest";
import { computeBoardProgress, statusCounts } from "@/entities/board/model/stats";
import type { ColumnWithCards } from "@/shared/types/database";

function col(name: string, n: number): ColumnWithCards {
  return {
    id: name, board_id: "b", name, position: name, created_at: "",
    cards: Array.from({ length: n }, (_, i) => ({
      id: `${name}-${i}`, column_id: name, title: "t", description: null, position: "",
      priority: "low", due_date: null, ai_category: null, github_url: null,
      created_by: null, created_at: "", updated_at: "", assignees: [], labels: [],
    })),
  };
}

describe("computeBoardProgress", () => {
  it("카드가 없으면 0", () => {
    expect(computeBoardProgress([col("Todo", 0), col("Done", 0)])).toBe(0);
  });
  it("마지막 컬럼 카드 비율을 % 로 반올림", () => {
    // 전체 4장 중 마지막(Done) 1장 => 25
    expect(computeBoardProgress([col("Todo", 2), col("Doing", 1), col("Done", 1)])).toBe(25);
  });
});

describe("statusCounts", () => {
  it("컬럼별 이름/카운트", () => {
    expect(statusCounts([col("Todo", 2), col("Done", 3)])).toEqual([
      { name: "Todo", count: 2 },
      { name: "Done", count: 3 },
    ]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run tests/unit/board-stats.test.ts`
Expected: FAIL (미정의).

- [ ] **Step 3: 구현 (`model/stats.ts` — 순수 함수, DB 의존 없음)**

```ts
import type { ColumnWithCards } from "@/shared/types/database";

/** 전체 카드 중 '마지막(완료) 컬럼' 카드 비율(0-100 정수). */
export function computeBoardProgress(columns: ColumnWithCards[]): number {
  const total = columns.reduce((n, c) => n + c.cards.length, 0);
  if (total === 0) return 0;
  const done = columns.length ? columns[columns.length - 1].cards.length : 0;
  return Math.round((done / total) * 100);
}

/** 컬럼별 카드 수. */
export function statusCounts(
  columns: ColumnWithCards[],
): { name: string; count: number }[] {
  return columns.map((c) => ({ name: c.name, count: c.cards.length }));
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run tests/unit/board-stats.test.ts`
Expected: PASS.

- [ ] **Step 5: 읽기 전용 쿼리 래퍼 (`api/stats.ts`)**

기존 패턴(`entities/board/api/queries.ts`)을 따라, 워크스페이스 단위 카운트만 얇게 추가. (보드 진행률/상태는 이미 로드된 `BoardWithColumns` 에서 순수 헬퍼로 계산하므로 추가 쿼리 불필요.)

```ts
import "server-only";
import { createServerClient } from "@/shared/api/supabase/server";

/** 워크스페이스의 보드/회의 수 (대시보드 카운터용, 읽기 전용). */
export async function getWorkspaceCounts(workspaceId: string): Promise<{
  boards: number;
  meetings: number;
}> {
  const supabase = await createServerClient();
  const [{ count: boards }, { count: meetings }] = await Promise.all([
    supabase.from("boards").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);
  return { boards: boards ?? 0, meetings: meetings ?? 0 };
}
```

> 주의: `createServerClient` 의 실제 export 이름을 `entities/board/api/queries.ts` 에서 확인하고 동일하게 import 할 것. 테이블/컬럼명은 `database.ts` 기준(`boards`, `meetings`, `workspace_id`).

- [ ] **Step 6: 타입·린트·테스트**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 통과 (총 단위 테스트 6파일 green).

- [ ] **Step 7: Commit**

```bash
git add src/entities/board/model/stats.ts tests/unit/board-stats.test.ts src/entities/board/api/stats.ts
git commit -m "feat(board): 보드 진행률/상태 순수 헬퍼(+테스트) + 카운트 쿼리"
```

---

## Phase 3 — 앱 쉘 (2단 좌측 내비)

### Task 7: IconRail + WorkPane + AppShell 재구성

**Files:**
- Create: `src/widgets/app-shell/ui/icon-rail.tsx`
- Create: `src/widgets/app-shell/ui/work-pane.tsx`
- Modify: `src/widgets/app-shell/ui/app-shell.tsx`

- [ ] **Step 1: `icon-rail.tsx`** — 56px 아이콘 레일 (현 app-shell.tsx 의 nav/avatar 로직 이전)

```tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Mic, Settings, LogOut } from "lucide-react";
import { createClient } from "@/shared/api/supabase/client";
import { cn } from "@/shared/lib/cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { UserProfile } from "@/shared/types/database";

const nav = [
  { href: "/workspaces", icon: LayoutGrid, label: "워크스페이스" },
  { href: "/meetings", icon: Mic, label: "회의록" },
  { href: "/settings", icon: Settings, label: "설정" },
];

export function IconRail({ user }: { user: UserProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-background py-3">
      <Link href="/workspaces" className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <LayoutGrid className="h-5 w-5" />
      </Link>
      {nav.map((n) => {
        const active = pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            title={n.label}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
              active && "bg-surface-2 text-foreground before:absolute before:-left-3 before:h-5 before:w-0.5 before:rounded-full before:bg-primary",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </Link>
        );
      })}
      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="h-8 w-8">
              {user.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback className="text-xs">
                {(user.display_name ?? user.email ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuLabel>{user.display_name ?? user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="h-4 w-4" /> 로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: `work-pane.tsx`** — 보조 패널 + 툴바 + 본문 조합 (페이지가 컴포즈)

```tsx
import { cn } from "@/shared/lib/cn";

export function WorkPane({
  secondary,
  toolbar,
  children,
  className,
}: {
  secondary?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex h-screen min-w-0 flex-1">
      {secondary && (
        <div className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/40 md:flex">
          {secondary}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {toolbar && (
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            {toolbar}
          </div>
        )}
        <div className={cn("min-h-0 flex-1 overflow-auto", className)}>{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `app-shell.tsx` 를 레일 + 본문으로 단순화**

```tsx
import { IconRail } from "./icon-rail";
import type { UserProfile } from "@/shared/types/database";

export function AppShell({ user, children }: { user: UserProfile; children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IconRail user={user} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: 타입·린트**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 5: 프리뷰 확인**

로그인 후 `/workspaces` 스크린샷 — 좌측 56px 아이콘 레일, 활성 인디케이터, 아바타 메뉴 동작.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/app-shell
git commit -m "feat(ui): 아이콘 레일 + WorkPane 2단 쉘 재구성"
```

---

## Phase 4 — 보드 (핵심 화면)

### Task 8: 보드 컬럼/카드 재스타일 + 드래그 비주얼

**Files:**
- Modify: `src/widgets/board-view/ui/board-column.tsx`, `card-item.tsx`

- [ ] **Step 1: `board-column.tsx` 표면/헤더 교체**

컨테이너 `w-72` → `w-[280px]`, `bg-muted/40` → `bg-surface/60 border border-border rounded-xl`. 헤더에 컬럼명 + `StatusPill`(카운트) + 메뉴. 드롭 영역 `isOver` 시 `ring-2 ring-primary/40`:

```tsx
// 컨테이너
<div className="flex w-[280px] shrink-0 flex-col rounded-xl border border-border bg-surface/60">
  <div className="flex items-center justify-between px-3 py-2.5">
    <h3 className="text-[13px] font-semibold text-foreground">{column.name}</h3>
    <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
      {column.cards.length}
    </span>
  </div>
  <div ref={setNodeRef} className={`flex-1 space-y-2 px-2 pb-2 transition-shadow ${isOver ? "rounded-lg ring-2 ring-primary/40" : ""}`}>
    {/* SortableContext + CardItem 동일 */}
  </div>
  <div className="p-2"><AddCard columnId={column.id} boardId={boardId} /></div>
</div>
```

- [ ] **Step 2: `card-item.tsx` 카드 룩 + 우선순위 좌측 바**

`rounded-md border bg-card p-3 shadow-sm` → 좌측 우선순위 컬러 바 + hover lift. 우선순위→tone 매핑은 StatusPill 톤 사용:

```tsx
const priorityTone = { low: "neutral", medium: "warning", high: "danger" } as const;
const priorityBar = { low: "bg-muted-foreground/40", medium: "bg-warning", high: "bg-destructive" } as const;

// 컨테이너
className={cn(
  "group relative overflow-hidden rounded-lg border border-border bg-surface-2 p-3 transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-card",
  isDragging && "opacity-50 shadow-elevated",
)}
// 내부 최상단에 좌측 바
<span className={cn("absolute inset-y-0 left-0 w-0.5", priorityBar[card.priority])} />
// 기존 Badge → StatusPill tone 적용, ai_category 는 tone="primary"
```

라벨 dot/담당자 아바타 스택은 구조 유지, 색·간격만 토큰화.

- [ ] **Step 3: 타입·린트**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 4: 프리뷰 — 보드에서 카드/드래그 확인**

보드 페이지 스크린샷 + `preview_click`/드래그는 어려우니 최소 hover 상태 확인. dnd 동작 회귀 없는지 콘솔 에러 확인.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/board-view/ui/board-column.tsx src/widgets/board-view/ui/card-item.tsx
git commit -m "feat(board): 컬럼/카드 다크 Linear 재스타일 + 우선순위 바"
```

### Task 9: 보드 툴바 + 컨텍스트 패널 + 보드/리스트 뷰 토글

**Files:**
- Create: `src/widgets/board-view/ui/board-toolbar.tsx`
- Create: `src/widgets/board-view/ui/board-context-panel.tsx`
- Create: `src/widgets/board-view/ui/board-list-view.tsx`
- Modify: `src/widgets/board-view/ui/board-view.tsx`

- [ ] **Step 1: `board-list-view.tsx`** — 표시 전용 테이블 (기존 store 의 columns 사용, 쓰기 없음)

```tsx
"use client";
import Link from "next/link";
import { useBoardStore } from "@/entities/board/model/store";
import { StatusPill } from "@/shared/ui/status-pill";

const priorityTone = { low: "neutral", medium: "warning", high: "danger" } as const;

export function BoardListView({ boardId }: { boardId: string }) {
  const columns = useBoardStore((s) => s.columns);
  const rows = columns.flatMap((c) => c.cards.map((card) => ({ card, columnName: c.name })));
  return (
    <table className="w-full text-[13px]">
      <thead className="border-b border-border text-left text-xs text-muted-foreground">
        <tr>
          <th className="px-4 py-2 font-medium">제목</th>
          <th className="px-4 py-2 font-medium">상태</th>
          <th className="px-4 py-2 font-medium">우선순위</th>
          <th className="px-4 py-2 font-medium">담당자</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ card, columnName }) => (
          <tr key={card.id} className="border-b border-border/60 hover:bg-surface-2">
            <td className="px-4 py-2">
              <Link href={`/board/${boardId}/card/${card.id}`} className="hover:text-primary">{card.title}</Link>
            </td>
            <td className="px-4 py-2"><StatusPill>{columnName}</StatusPill></td>
            <td className="px-4 py-2"><StatusPill tone={priorityTone[card.priority]}>{card.priority}</StatusPill></td>
            <td className="px-4 py-2 text-muted-foreground">{card.assignees.map((a) => a.display_name ?? a.email).join(", ") || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: `board-toolbar.tsx`** — 보드명 + Board/List 토글 + presence 슬롯

```tsx
"use client";
import { LayoutGrid, List } from "lucide-react";
import { SegmentedControl } from "@/shared/ui/segmented-control";

export type BoardViewMode = "board" | "list";

export function BoardToolbar({
  name, mode, onMode, right,
}: {
  name: string;
  mode: BoardViewMode;
  onMode: (m: BoardViewMode) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      <h1 className="text-[15px] font-semibold text-foreground">{name}</h1>
      <SegmentedControl
        value={mode}
        onChange={onMode}
        options={[
          { value: "board", label: <><LayoutGrid className="h-3.5 w-3.5" /> 보드</> },
          { value: "list", label: <><List className="h-3.5 w-3.5" /> 리스트</> },
        ]}
      />
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </div>
  );
}
```

- [ ] **Step 3: `board-context-panel.tsx`** — Overview 스탯 + 진행률 (이미 로드된 board 데이터로 계산)

```tsx
"use client";
import { useBoardStore } from "@/entities/board/model/store";
import { computeBoardProgress, statusCounts } from "@/entities/board/model/stats";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { StatCard } from "@/shared/ui/stat-card";

export function BoardContextPanel() {
  const columns = useBoardStore((s) => s.columns);
  const progress = computeBoardProgress(columns);
  const counts = statusCounts(columns);
  const total = counts.reduce((n, c) => n + c.count, 0);
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>진행률</span><span className="tabular-nums">{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="전체 카드" value={total} />
        <StatCard label="컬럼" value={counts.length} />
      </div>
      <div className="space-y-1">
        {counts.map((c) => (
          <div key={c.name} className="flex items-center justify-between rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface-2">
            <span>{c.name}</span><span className="tabular-nums">{c.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `board-view.tsx` 를 WorkPane + 토글로 재구성**

상단 타이틀 바를 제거하고 `WorkPane`(secondary=BoardContextPanel, toolbar=BoardToolbar)로 감싼다. `mode` 상태로 Board(DndContext)/List 전환. DndContext·sensors·onDragEnd·useBoardRealtime 로직은 그대로 유지:

```tsx
"use client";
import { useEffect, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useBoardStore } from "@/entities/board/model/store";
import { useBoardRealtime } from "@/entities/board/model/use-board-realtime";
import { useCardDnd } from "@/features/card-drag/model/use-card-dnd";
import type { BoardWithColumns } from "@/shared/types/database";
import { WorkPane } from "@/widgets/app-shell/ui/work-pane";
import { BoardColumn } from "./board-column";
import { BoardToolbar, type BoardViewMode } from "./board-toolbar";
import { BoardContextPanel } from "./board-context-panel";
import { BoardListView } from "./board-list-view";

export function BoardView({ initial }: { initial: BoardWithColumns }) {
  const setBoard = useBoardStore((s) => s.setBoard);
  const columns = useBoardStore((s) => s.columns);
  const { onDragEnd } = useCardDnd(initial.id);
  const [mode, setMode] = useState<BoardViewMode>("board");
  useBoardRealtime(initial.id);
  useEffect(() => { setBoard(initial); }, [initial, setBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <WorkPane
      secondary={<BoardContextPanel />}
      toolbar={<BoardToolbar name={initial.name} mode={mode} onMode={setMode} />}
    >
      {mode === "board" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="flex h-full gap-4 overflow-x-auto p-6">
            {columns.map((col) => (
              <BoardColumn key={col.id} column={col} boardId={initial.id} />
            ))}
          </div>
        </DndContext>
      ) : (
        <BoardListView boardId={initial.id} />
      )}
    </WorkPane>
  );
}
```

> 주의: `board/[boardId]/layout.tsx` 가 추가 래퍼(예: 자체 헤더/높이)를 두고 있으면 WorkPane 의 `h-screen` 과 중복되지 않게 조정. 먼저 해당 layout 을 읽고 충돌 시 래퍼 높이만 제거.

- [ ] **Step 5: 타입·린트·테스트**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 통과.

- [ ] **Step 6: 프리뷰 — 보드/리스트 토글 동작**

보드 페이지에서 `preview_click` 으로 리스트 토글 → `preview_snapshot` 으로 테이블 렌더 확인 → 다시 보드. 드래그 회귀 없는지 콘솔 확인.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/board-view/ui
git commit -m "feat(board): WorkPane 툴바·컨텍스트 패널·리스트 뷰 토글"
```

---

## Phase 5 — 나머지 화면

### Task 10: 워크스페이스 목록 + 상세(보드 그리드)

**Files:**
- Modify: `src/app/(main)/workspaces/page.tsx`, `src/app/(main)/workspaces/[id]/page.tsx`

- [ ] **Step 1: `workspaces/page.tsx`** — 헤더 + 카드 그리드 + EmptyState

`max-w-4xl p-6` 유지하되 빈 상태를 `EmptyState`(아이콘 + 문구 + CTA)로, 카드 hover lift, 역할 `StatusPill`. (데이터 로딩 `listMyWorkspaces` 그대로.)

- [ ] **Step 2: `workspaces/[id]/page.tsx`** — 보드 그리드(진행률 바·멤버 아바타·카드 수)

해당 페이지가 보드 목록을 로드하는 기존 쿼리를 유지하고, 각 보드를 카드로 렌더. 진행률은 보드 상세를 로드하지 않으므로(목록 단계) 표시 생략하거나, 목록 쿼리가 컬럼/카드 카운트를 포함하면 `computeBoardProgress` 적용. **먼저 이 페이지의 기존 데이터 형태를 읽고 그에 맞춰 렌더** (없는 필드는 만들지 않는다).

- [ ] **Step 3: 타입·린트**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 4: 프리뷰 확인** — `/workspaces` 와 워크스페이스 상세 스크린샷.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(main)/workspaces"
git commit -m "feat(ui): 워크스페이스 목록·상세 다크 재스타일"
```

### Task 11: 카드 상세 슬라이드오버 (탭: 개요/활동)

**Files:**
- Modify: `src/widgets/card-detail-panel/ui/card-modal.tsx`, `card-detail.tsx`

- [ ] **Step 1: `card-modal.tsx` 를 SlideOver 로 교체**

기존 Dialog 래퍼를 `SlideOver`/`SlideOverContent`(우측 패널)로 교체. 인터셉트 라우트(`@modal/(.)card/[cardId]`)·닫기 시 `router.back()` 동작은 유지. 먼저 현재 파일을 읽어 open/onOpenChange 배선을 그대로 SlideOver 에 연결.

- [ ] **Step 2: `card-detail.tsx` 에 Tabs 적용**

내용을 `Tabs`(개요/활동)로 분리: 개요=설명·우선순위(StatusPill)·라벨·담당자·GitHub 링크, 활동=코멘트 목록/입력. 데이터·액션 호출은 기존 그대로, 마크업만 재배치.

- [ ] **Step 3: 타입·린트**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 4: 프리뷰 — 카드 클릭 → 슬라이드오버**

보드에서 카드 클릭 → 우측 패널 슬라이드인 → 탭 전환 → 닫기(`router.back`) 확인.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/card-detail-panel/ui
git commit -m "feat(ui): 카드 상세 우측 슬라이드오버 + 개요/활동 탭"
```

### Task 12: 회의록 목록·상세 + 설정 + 인증

**Files:**
- Modify: `src/app/(main)/meetings/page.tsx`, `src/app/(main)/meetings/[meetingId]/page.tsx`, `src/widgets/meeting-panel/ui/meeting-detail.tsx`
- Modify: `src/app/(main)/settings/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/features/auth-sign-in/ui/auth-form.tsx`

- [ ] **Step 1: 회의록** — 목록은 회의 카드/행(제목·날짜·상태 `StatusPill` tone: `done`→success, `pending`→warning). 상세는 `Tabs`(트랜스크립트/추출된 작업). 업로드 존(`upload-form`)은 점선 드래그&드롭 스타일. "카드로 보내기"(`meeting-to-cards/action-items`)는 accent 버튼. 로직 호출 불변.

- [ ] **Step 2: 설정** — 좌측 섹션 리스트(일반/연동) + 우측 컨텐츠. GitHub 연동 폼(`github-link-card/repo-form`)을 `Card` 로 감싸고 입력/버튼 토큰화.

- [ ] **Step 3: 인증** — `login/signup/page.tsx` 풀스크린 딥 다크 + 중앙 카드 방사형 글로우(`bg-[radial-gradient(...)]` 또는 `shadow-glow`). `auth-form.tsx` 입력/버튼/OAuth 버튼 아이콘 토큰화. 로직 불변.

- [ ] **Step 4: 타입·린트·테스트**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 통과.

- [ ] **Step 5: 프리뷰 확인** — `/login`, `/meetings`, 회의 상세, `/settings` 스크린샷.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(main)/meetings" "src/app/(main)/settings" "src/app/(auth)" src/widgets/meeting-panel src/features/auth-sign-in src/features/meeting-record src/features/meeting-to-cards src/features/github-link-card
git commit -m "feat(ui): 회의록·설정·인증 화면 다크 재스타일"
```

### Task 13: 잔여 feature 다이얼로그 + presence + 최종 검수

**Files:**
- Modify: `src/features/{card-create,board-create,workspace-create,ai-classify-card}/ui/*.tsx`
- Modify: `src/widgets/presence-cursors/ui/presence-cursors.tsx`

- [ ] **Step 1: 생성/분류 다이얼로그·인라인 폼 토큰화**

`add-card`, `create-board-dialog`, `create-workspace-dialog`, `classify-panel` 의 컨테이너/입력/버튼을 새 프리미티브에 맞춤. (`add-card` 의 추가 버튼·인풋만, 동작 불변.)

- [ ] **Step 2: presence 커서/아바타 색**

`presence-cursors` 의 커서/아바타가 `peer-color` 로직(유지)을 쓰되 다크 배경에서 대비 충분한지 확인, 테두리 `border-background` 유지.

- [ ] **Step 3: 타입·린트·테스트 + 전체 프리뷰 스윕**

Run: `pnpm typecheck && pnpm lint && pnpm test`
화면별 스크린샷(로그인/워크스페이스/보드/보드-리스트/카드 슬라이드오버/회의록/설정) 확보. `preview_console_logs` 로 에러 0 확인. `preview_resize` 로 좁은 폭에서 보조 패널 숨김(md 미만) 확인.

- [ ] **Step 4: Commit**

```bash
git add src/features src/widgets/presence-cursors
git commit -m "feat(ui): 생성 다이얼로그·presence 다크 마감 + 전체 검수"
```

---

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지:** 토큰(T1)·타이포(T1)·shared/ui(T2,4,5)·2단 내비(T7)·보드 컬럼/카드/툴바/컨텍스트/리스트(T8,9)·읽기 집계+스파크라인(T3,5,6,9)·워크스페이스(T10)·카드 슬라이드오버 탭(T11)·회의록/설정/인증(T12)·생성/ presence(T13) — 스펙 6~12 전 항목 태스크 매핑됨.
- **확정 기본값 반영:** 슬라이드오버(T11)/List 뷰(T9)/Radix Tabs·Switch(T5) — 모두 반영.
- **타입 일관성:** `buildSparkline`(T3) ↔ `Sparkline`(T5) ↔ `StatCard`(T5); `computeBoardProgress`/`statusCounts`(T6) ↔ `BoardContextPanel`(T9); `BoardViewMode`(T9) 단일 정의.
- **로직 불변 가드:** 모든 데이터/액션/dnd/실시간 호출은 기존 그대로, 신규는 순수 헬퍼·읽기 쿼리·표시 컴포넌트뿐. 기존 단위 테스트 4종 매 태스크에서 green 확인.
- **알려진 주의:** T6 `createServerClient` import 이름, T9 board layout 높이 충돌, T10 워크스페이스 상세 데이터 형태, T11 인터셉트 open 배선 — 각 태스크에 "먼저 읽고 맞춰라" 가드 명시 (없는 데이터는 만들지 않음).

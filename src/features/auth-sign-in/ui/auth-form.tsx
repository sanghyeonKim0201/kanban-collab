"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Github, KeyRound } from "lucide-react";
import { createClient } from "@/shared/api/supabase/client";
import { publicEnv } from "@/shared/config/env";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  signInSchema,
  signUpSchema,
  type SignUpValues,
} from "../model/schema";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(isSignup ? signUpSchema : signInSchema),
  });

  async function onSubmit(values: SignUpValues) {
    setLoading(true);
    try {
      const supabase = createClient();
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { full_name: values.displayName } },
        });
        if (error) throw error;
        toast.success("가입 완료. 이메일을 확인하거나 바로 로그인하세요.");
        router.push("/login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
        router.push("/workspaces");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "인증 실패");
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: "google" | "github") {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OAuth 실패");
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-elevated">
      <CardHeader className="pb-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <CardTitle>{isSignup ? "회원가입" : "로그인"}</CardTitle>
        </div>
        <CardDescription>
          칸반 협업 도구 — 실시간으로 함께 일하세요.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {isSignup && (
            <div className="space-y-1.5">
              <Label htmlFor="displayName">이름</Label>
              <Input id="displayName" {...register("displayName")} />
              {errors.displayName && (
                <p className="text-xs text-destructive">
                  {errors.displayName.message}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">비밀번호</Label>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "처리 중…" : isSignup ? "가입하기" : "로그인"}
          </Button>
          <div className="relative flex w-full items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-foreground">또는</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => oauth("google")}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => oauth("github")}
            >
              <Github className="h-4 w-4" /> GitHub
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {isSignup ? (
              <>
                이미 계정이 있나요?{" "}
                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                  로그인
                </Link>
              </>
            ) : (
              <>
                계정이 없나요?{" "}
                <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                  회원가입
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

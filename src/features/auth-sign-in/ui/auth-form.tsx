"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Github } from "lucide-react";
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isSignup ? "회원가입" : "로그인"}</CardTitle>
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
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => oauth("google")}
            >
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => oauth("github")}
            >
              <Github /> GitHub
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {isSignup ? (
              <>
                이미 계정이 있나요?{" "}
                <Link href="/login" className="underline">
                  로그인
                </Link>
              </>
            ) : (
              <>
                계정이 없나요?{" "}
                <Link href="/signup" className="underline">
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

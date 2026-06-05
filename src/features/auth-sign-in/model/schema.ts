import { z } from "zod";

// 로그인은 비밀번호 정책을 강제하지 않는다(정책 검증은 회원가입의 몫).
// 기존 계정/데모 계정이 짧은 비밀번호여도 로그인 가능해야 한다.
export const signInSchema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});

export const signUpSchema = signInSchema.extend({
  password: z.string().min(6, "비밀번호는 6자 이상입니다"),
  displayName: z.string().min(1, "이름을 입력하세요"),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요"),
  password: z.string().min(6, "비밀번호는 6자 이상입니다"),
});

export const signUpSchema = signInSchema.extend({
  displayName: z.string().min(1, "이름을 입력하세요"),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

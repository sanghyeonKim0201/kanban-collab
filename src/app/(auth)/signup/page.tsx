import { AuthForm } from "@/features/auth-sign-in/ui/auth-form";

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <AuthForm mode="signup" />
    </main>
  );
}

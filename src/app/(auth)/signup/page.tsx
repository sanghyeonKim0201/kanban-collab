import { AuthForm } from "@/features/auth-sign-in/ui/auth-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <AuthForm mode="signup" />
    </main>
  );
}

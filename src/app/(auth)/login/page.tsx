import { AuthForm } from "@/features/auth-sign-in/ui/auth-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <AuthForm mode="login" />
    </main>
  );
}

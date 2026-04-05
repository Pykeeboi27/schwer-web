"use client";

import {
  loginAction,
  type LoginActionState,
} from "@/app/auth/login/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

export function getLoginErrorMessage(error: string | null): string | null {
  if (!error) {
    return null;
  }

  if (error.toLowerCase().includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox for the confirmation link.";
  }

  return error;
}

const initialLoginActionState: LoginActionState = {
  error: null,
  success: false,
};

export function LoginForm({
  redirectTo,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  redirectTo?: string | null;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialLoginActionState,
  );
  const router = useRouter();

  const errorMessage = getLoginErrorMessage(state.error);

  useEffect(() => {
    if (state.success) {
      const nextPath = redirectTo
        ? `/protected?redirectTo=${encodeURIComponent(redirectTo)}`
        : "/protected";

      router.push(nextPath);
    }
  }, [redirectTo, router, state.success]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-primary/20 bg-background/85 shadow-2xl backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight">Login</CardTitle>
          <CardDescription>
            Enter your credentials to access Schwer Online Management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type={isPasswordVisible ? "text" : "password"}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPasswordVisible((prev) => !prev)}
                  aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                >
                  {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
              <Button type="submit" className="w-full font-semibold" disabled={isPending}>
                {isPending ? "Logging in..." : "Login"}
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link href="/auth/oauth/google">Continue with Google</Link>
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

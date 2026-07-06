"use client";

import { signUpAction, type SignUpActionState } from "@/app/auth/sign-up/actions";
import { DEPARTMENTS } from "@/lib/profile/departments";
import { fieldClassName } from "@/components/patterns";
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

const initialSignUpActionState: SignUpActionState = {
  error: null,
  success: false,
};

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isRepeatPasswordVisible, setIsRepeatPasswordVisible] = useState(false);
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    initialSignUpActionState,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/protected");
    }
  }, [router, state.success]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-none bg-transparent shadow-none">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Create account
          </CardTitle>
          <CardDescription>Create your Schwer Online Management account</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <form action={formAction}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="department">Department</Label>
                <select
                  id="department"
                  name="department"
                  required
                  defaultValue=""
                  className={cn(fieldClassName, "h-9 py-1")}
                >
                  <option value="" disabled>
                    Select department
                  </option>
                  {DEPARTMENTS.map((department) => (
                    <option key={department} value={department} className="capitalize">
                      {department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={isPasswordVisible ? "text" : "password"}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="repeat-password">Repeat password</Label>
                <div className="relative">
                  <Input
                    id="repeat-password"
                    name="repeatPassword"
                    type={isRepeatPasswordVisible ? "text" : "password"}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setIsRepeatPasswordVisible((prev) => !prev)}
                    aria-label={
                      isRepeatPasswordVisible
                        ? "Hide repeat password"
                        : "Show repeat password"
                    }
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {isRepeatPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {state.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {state.error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Creating account…" : "Create account"}
              </Button>
            </div>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

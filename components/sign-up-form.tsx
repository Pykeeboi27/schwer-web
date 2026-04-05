"use client";

import {
  signUpAction,
  type SignUpActionState,
} from "@/app/auth/sign-up/actions";
import { DEPARTMENTS } from "@/lib/profile/departments";
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
      <Card className="border-primary/20 bg-background/85 shadow-2xl backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight">Sign up</CardTitle>
          <CardDescription>Create your Schwer Online Management account</CardDescription>
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
                <Label htmlFor="department">Department</Label>
                <select
                  id="department"
                  name="department"
                  required
                  defaultValue=""
                  className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
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
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">Repeat Password</Label>
                </div>
                <Input
                  id="repeat-password"
                  name="repeatPassword"
                  type={isRepeatPasswordVisible ? "text" : "password"}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRepeatPasswordVisible((prev) => !prev)}
                  aria-label={
                    isRepeatPasswordVisible
                      ? "Hide repeat password"
                      : "Show repeat password"
                  }
                >
                  {isRepeatPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {state.error && <p className="text-sm text-red-500">{state.error}</p>}
              <Button type="submit" className="w-full font-semibold" disabled={isPending}>
                {isPending ? "Creating an account..." : "Sign up"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

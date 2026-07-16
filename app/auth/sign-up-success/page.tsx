import { AuthShell } from "@/components/auth/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function Page() {
  return (
    <AuthShell>
      <Card className="border-none bg-transparent shadow-none">
        <CardHeader className="px-0">
          <CardTitle className="text-3xl font-semibold tracking-tight">
            Check your email
          </CardTitle>
          <CardDescription className="text-base">Account created</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <p className="text-base text-muted-foreground">
            You&apos;ve successfully signed up. Please check your email to confirm your
            account before signing in.
          </p>
          <div className="mt-5 text-center text-base text-muted-foreground">
            <Link
              href="/auth/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

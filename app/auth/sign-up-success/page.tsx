import { AuthShell } from "@/components/auth/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <AuthShell>
      <Card className="border-none bg-transparent shadow-none">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Check your email
          </CardTitle>
          <CardDescription>Account created</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <p className="text-sm text-muted-foreground">
            You&apos;ve successfully signed up. Please check your email to confirm your
            account before signing in.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

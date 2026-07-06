import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retry?: string }>;
}) {
  const params = await searchParams;
  const retryPath = params?.retry ?? "/auth/login";

  return (
    <>
      {params?.error ? (
        <p className="text-sm text-muted-foreground">Code error: {params.error}</p>
      ) : (
        <p className="text-sm text-muted-foreground">An unspecified error occurred.</p>
      )}

      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href={retryPath}>Try again</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/auth/login">Back to login</Link>
        </Button>
      </div>
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retry?: string }>;
}) {
  return (
    <AuthShell>
      <Card className="border-none bg-transparent shadow-none">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Sorry, something went wrong.
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading error details…</p>
            }
          >
            <ErrorContent searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

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
        <p className="text-sm text-muted-foreground">
          Code error: {params.error}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          An unspecified error occurred.
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <Link
          href={retryPath}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </Link>
        <Link
          href="/auth/login"
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
        >
          Back to login
        </Link>
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
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Sorry, something went wrong.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<p className="text-sm text-muted-foreground">Loading error details...</p>}>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

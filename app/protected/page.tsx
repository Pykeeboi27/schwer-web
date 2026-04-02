import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getPostAuthRedirectPath } from "@/lib/profile/redirect-to-dashboard";

async function ProtectedPageContent() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  redirect(getPostAuthRedirectPath(profile));

  return null;
}

export default function ProtectedPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      <ProtectedPageContent />
    </Suspense>
  );
}

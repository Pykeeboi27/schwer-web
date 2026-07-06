import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { MobileNav } from "@/components/layouts/mobile-nav";

export async function MobileNavSlot() {
  const profile = await getCurrentProfile();
  return <MobileNav currentUserRole={profile?.role ?? null} />;
}

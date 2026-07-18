import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getUnseenSections } from "@/lib/notifications/queries";
import { MobileNav } from "@/components/layouts/mobile-nav";

export async function MobileNavSlot() {
  const profile = await getCurrentProfile();
  const unseenSections = await getUnseenSections();
  return (
    <MobileNav
      currentUserRole={profile?.role ?? null}
      unseenSections={Array.from(unseenSections)}
    />
  );
}

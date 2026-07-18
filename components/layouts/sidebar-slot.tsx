import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { getUnseenSections } from "@/lib/notifications/queries";
import { Sidebar } from "@/components/layouts/sidebar";

export async function SidebarSlot() {
  const profile = await getCurrentProfile();
  const unseenSections = await getUnseenSections();
  return (
    <Sidebar
      currentUserRole={profile?.role ?? null}
      unseenSections={Array.from(unseenSections)}
    />
  );
}

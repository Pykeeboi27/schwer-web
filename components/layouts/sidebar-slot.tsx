import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { Sidebar } from "@/components/layouts/sidebar";

export async function SidebarSlot() {
  const profile = await getCurrentProfile();
  return <Sidebar currentUserRole={profile?.role ?? null} />;
}

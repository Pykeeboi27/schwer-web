import { getCurrentProfile } from "@/lib/profile/get-current-profile";
import { Sidebar } from "@/components/layouts/Sidebar";

export async function SidebarSlot() {
  const profile = await getCurrentProfile();
  return <Sidebar currentUserRole={profile?.role ?? null} />;
}

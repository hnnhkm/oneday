import { requireAdmin } from "@/lib/supabase/require-admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="flex flex-col md:flex-row">
      <AdminSidebar user={user} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Activity,
  InstructorProfile,
  User,
  UserRole,
  ActivityStatus,
} from "@/lib/types/database";
import {
  applyLegacySynthesisToRow,
  type SessionLike,
} from "@/lib/queries/session-synthesis";

/**
 * Admin queries use the service-role client directly so they can
 * read every row regardless of RLS (which is scoped to the logged-in
 * user in most places). The calling page is already protected by
 * requireAdmin() at the top of its server component, so bypassing
 * RLS here is intentional.
 */

export interface AdminDashboardStats {
  userCount: number;
  instructorCount: number;
  pendingApplicationCount: number;
  activityCount: number;
  publishedActivityCount: number;
  bookingCount: number;
  totalRevenueCents: number;
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const admin = createAdminClient();

  const [
    { count: userCount },
    { count: instructorCount },
    { count: pendingApplicationCount },
    { count: activityCount },
    { count: publishedActivityCount },
    { count: bookingCount },
    { data: paidBookings },
  ] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }),
    admin
      .from("instructor_profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "approved"),
    admin
      .from("instructor_profiles")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    admin.from("activities").select("id", { count: "exact", head: true }),
    admin
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    admin.from("bookings").select("id", { count: "exact", head: true }),
    admin
      .from("bookings")
      .select("total_price_cents, payment_status")
      .in("payment_status", ["paid"]),
  ]);

  const totalRevenueCents = (
    (paidBookings as Array<{ total_price_cents: number }>) || []
  ).reduce((s, b) => s + (b.total_price_cents || 0), 0);

  return {
    userCount: userCount || 0,
    instructorCount: instructorCount || 0,
    pendingApplicationCount: pendingApplicationCount || 0,
    activityCount: activityCount || 0,
    publishedActivityCount: publishedActivityCount || 0,
    bookingCount: bookingCount || 0,
    totalRevenueCents,
  };
}

export async function fetchAllUsers(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: User[]; total: number }> {
  const admin = createAdminClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, count } = await query;
  return {
    rows: (data as User[]) || [],
    total: count || 0,
  };
}

export async function fetchAllActivities(params: {
  status?: ActivityStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<{
  rows: Array<Activity & { instructor_name: string }>;
  total: number;
}> {
  const admin = createAdminClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Phase 6B: `activities.date` is gone. The admin listing doesn't
  // need to be session-accurately ordered — chronologically-created
  // is fine for an audit/moderation view — so we sort by `created_at`
  // server-side and synthesize legacy date/time fields in JS so the
  // admin table keeps rendering "date" without a schema coupling.
  let query = admin
    .from("activities")
    .select(
      `
      *,
      instructor_profiles!inner (
        users!inner (name)
      ),
      activity_sessions (
        id, starts_at, ends_at, max_seats, seats_remaining, status, local_date, local_time
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, count } = await query;

  type Joined = Activity & {
    instructor_profiles: { users: { name: string } };
    activity_sessions?: SessionLike[];
  };
  const rows = ((data as unknown as Joined[]) || []).map((r) => {
    const synthed = applyLegacySynthesisToRow(r);
    return {
      ...synthed,
      instructor_name: synthed.instructor_profiles?.users?.name || "—",
    };
  });

  return { rows, total: count || 0 };
}

export async function fetchPendingApplicationsForAdmin(): Promise<
  Array<
    InstructorProfile & {
      users: { name: string; email: string; avatar_url: string | null };
    }
  >
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("instructor_profiles")
    .select(
      `
      *,
      users!inner (name, email, avatar_url)
    `
    )
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false });

  return (data as unknown as Array<
    InstructorProfile & {
      users: { name: string; email: string; avatar_url: string | null };
    }
  >) || [];
}

export interface AdminActionRow {
  id: string;
  admin_user_id: string;
  admin_name: string;
  action_type: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Read the admin_actions audit log with the acting admin's name
 * joined in. Service-role client (the page is already behind
 * requireAdmin) + pagination + optional filter by action_type.
 */
export async function fetchAdminActions(params: {
  actionType?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminActionRow[]; total: number }> {
  const admin = createAdminClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from("admin_actions")
    .select(
      `
      *,
      users!admin_actions_admin_user_id_fkey (name)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.actionType && params.actionType !== "all") {
    query = query.eq("action_type", params.actionType);
  }

  const { data, count } = await query;

  type Joined = {
    id: string;
    admin_user_id: string;
    action_type: string;
    target_type: string;
    target_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
    users: { name: string } | null;
  };

  const rows: AdminActionRow[] = ((data as unknown as Joined[]) || []).map(
    (r) => ({
      id: r.id,
      admin_user_id: r.admin_user_id,
      admin_name: r.users?.name || "—",
      action_type: r.action_type,
      target_type: r.target_type,
      target_id: r.target_id,
      metadata: r.metadata || {},
      created_at: r.created_at,
    })
  );

  return { rows, total: count || 0 };
}

export function formatRoleBadge(role: UserRole): {
  label: string;
  className: string;
} {
  switch (role) {
    case "admin":
      return {
        label: "Admin",
        className: "bg-red-50 text-red-700",
      };
    case "instructor":
      return {
        label: "Instrutor",
        className: "bg-primary-50 text-primary-600",
      };
    default:
      return {
        label: "Usuário",
        className: "bg-background-muted text-charcoal-lighter",
      };
  }
}

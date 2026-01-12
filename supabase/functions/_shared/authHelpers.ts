import { getSupabaseClient, supabaseAdmin } from "./supabase.ts";

export const ErrorResponses = {
  UNAUTHORIZED: {
    error: "Unauthorized",
    code: "UNAUTHORIZED",
    message: "Authentication required",
  },
  NAME_REQUIRED: {
    error: "Name required",
    code: "NAME_REQUIRED",
    message: "Please set your display name before performing this action",
  },
  FORBIDDEN: {
    error: "Forbidden",
    code: "FORBIDDEN",
    message: "Insufficient permissions",
  },
  BOARD_NOT_FOUND: {
    error: "Board not found",
    code: "BOARD_NOT_FOUND",
  },
  INVALID_INPUT: { error: "Invalid input", code: "INVALID_INPUT" },
};

function toAppUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    full_name:
      (metadata.full_name as string | undefined) ??
      (metadata.name as string | undefined) ??
      "",
    profile_photo_url: metadata.profile_photo_url as string | undefined,
  };
}

export async function checkAuthentication(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : null;

  const supabase = getSupabaseClient(req);

  if (!token) {
    return { authenticated: false, user: null, supabase };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    if (error) {
      console.error("Auth getUser (admin) failed:", error);
    }
    return { authenticated: false, user: null, supabase };
  }

  return { authenticated: true, user: toAppUser(data.user), supabase };
}

export async function requireAuth(req: Request) {
  const { authenticated, user, supabase } = await checkAuthentication(req);

  if (!authenticated) {
    return {
      success: false,
      user: null,
      supabase,
      error: Response.json(ErrorResponses.UNAUTHORIZED, { status: 401 }),
    };
  }

  return { success: true, user, supabase, error: null };
}

export function requireDisplayName(user: { full_name?: string | null }) {
  if (!user.full_name || user.full_name.trim() === "") {
    return {
      success: false,
      error: Response.json(ErrorResponses.NAME_REQUIRED, { status: 403 }),
    };
  }

  return { success: true, error: null };
}

export async function getUserBoardRole(
  boardId: string,
  userId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("board_roles")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching board role:", error);
    return null;
  }

  return data?.role ?? null;
}

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 4,
  support: 3,
  contributor: 2,
  viewer: 1,
};

export async function requireMinimumRole(
  boardId: string,
  userId: string,
  minimumRole: string,
) {
  const userRole = await getUserBoardRole(boardId, userId);

  if (!userRole) {
    return {
      success: false,
      role: null,
      error: Response.json(ErrorResponses.FORBIDDEN, { status: 403 }),
    };
  }

  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;

  if (userLevel < requiredLevel) {
    return {
      success: false,
      role: userRole,
      error: Response.json(
        {
          ...ErrorResponses.FORBIDDEN,
          message: `Requires ${minimumRole} role or higher`,
          current_role: userRole,
        },
        { status: 403 },
      ),
    };
  }

  return { success: true, role: userRole, error: null };
}

export async function requireAdmin(boardId: string, userId: string) {
  return await requireMinimumRole(boardId, userId, "admin");
}

export async function requireStaff(boardId: string, userId: string) {
  return await requireMinimumRole(boardId, userId, "support");
}

export async function verifyBoard(boardId: string) {
  const { data, error } = await supabaseAdmin
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error verifying board:", error);
    return {
      success: false,
      board: null,
      error: Response.json({ error: "Failed to verify board" }, { status: 500 }),
    };
  }

  if (!data) {
    return {
      success: false,
      board: null,
      error: Response.json(ErrorResponses.BOARD_NOT_FOUND, { status: 404 }),
    };
  }

  return { success: true, board: data, error: null };
}

export async function authorizeWriteAction(
  req: Request,
  boardId: string,
  minimumRole = "contributor",
) {
  const authCheck = await requireAuth(req);
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  const user = authCheck.user;

  const boardCheck = await verifyBoard(boardId);
  if (!boardCheck.success) {
    return { success: false, error: boardCheck.error };
  }

  const roleCheck = await requireMinimumRole(
    boardId,
    user.id,
    minimumRole,
  );
  if (!roleCheck.success) {
    return { success: false, error: roleCheck.error };
  }

  const nameCheck = requireDisplayName(user);
  if (!nameCheck.success) {
    return { success: false, error: nameCheck.error };
  }

  return {
    success: true,
    user,
    board: boardCheck.board,
    role: roleCheck.role,
    supabase: authCheck.supabase,
    error: null,
  };
}

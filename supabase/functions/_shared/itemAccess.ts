import {
  checkAuthentication,
  getUserBoardRole,
  verifyBoard,
} from "./authHelpers.ts";
import { supabaseAdmin } from "./supabase.ts";

export async function resolveBoardFromPayload(payload: Record<string, unknown>) {
  const boardId = typeof payload.board_id === "string" ? payload.board_id : null;
  const slug = typeof payload.slug === "string" ? payload.slug : null;

  if (boardId) {
    return { boardId, board: null, error: null };
  }

  if (!slug) {
    return { boardId: null, board: null, error: "board_id or slug is required" };
  }

  const { data, error } = await supabaseAdmin
    .from("boards")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("resolveBoardFromPayload slug lookup error:", error);
    return { boardId: null, board: null, error: "Unable to resolve board" };
  }

  if (!data) {
    return { boardId: null, board: null, error: "Board not found" };
  }

  return { boardId: data.id as string, board: data, error: null };
}

export async function requireBoardReadAccess(req: Request, payload: Record<string, unknown>) {
  const boardLookup = await resolveBoardFromPayload(payload);
  if (!boardLookup.boardId) {
    return {
      success: false,
      status: 400,
      error: boardLookup.error || "Invalid board reference",
      board: null,
      user: null,
      role: null,
      isPublicAccess: false,
    };
  }

  const boardCheck = boardLookup.board
    ? { success: true, board: boardLookup.board, error: null }
    : await verifyBoard(boardLookup.boardId);

  if (!boardCheck.success) {
    return {
      success: false,
      status: 404,
      error: "Board not found",
      board: null,
      user: null,
      role: null,
      isPublicAccess: false,
    };
  }

  const authCheck = await checkAuthentication(req);

  if (boardCheck.board.visibility === "public" && !authCheck.authenticated) {
    return {
      success: true,
      board: boardCheck.board,
      user: null,
      role: null,
      isPublicAccess: true,
    };
  }

  if (!authCheck.authenticated || !authCheck.user) {
    return {
      success: false,
      status: 401,
      error: "Authentication required",
      board: null,
      user: null,
      role: null,
      isPublicAccess: false,
    };
  }

  const role = await getUserBoardRole(boardLookup.boardId, authCheck.user.id);
  if (!role && boardCheck.board.visibility !== "public") {
    return {
      success: false,
      status: 403,
      error: "This workspace is not accessible",
      board: null,
      user: authCheck.user,
      role: null,
      isPublicAccess: false,
    };
  }

  return {
    success: true,
    board: boardCheck.board,
    user: authCheck.user,
    role: role || "viewer",
    isPublicAccess: !role,
  };
}

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireAuth, ErrorResponses } from './authHelpers.js';

/**
 * Update user profile
 * Endpoint: POST /api/user/update
 * Auth: Required
 * 
 * Request: {
 *   first_name?: string,
 *   last_name?: string,
 *   full_name?: string,
 *   profile_photo_url?: string (optional, non-blocking)
 * }
 * 
 * Response: { success: boolean, user: object }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { first_name, last_name, full_name, profile_photo_url } = payload;

    // Require authentication
    const authCheck = await requireAuth(base44);
    if (!authCheck.success) {
      return authCheck.error;
    }

    const updates = {};

    const trimmedFirstName =
      typeof first_name === 'string' ? first_name.trim() : undefined;
    const trimmedLastName =
      typeof last_name === 'string' ? last_name.trim() : undefined;

    if (trimmedFirstName !== undefined || trimmedLastName !== undefined) {
      if (!trimmedFirstName || !trimmedLastName) {
        return Response.json({
          error: 'Invalid name',
          code: 'INVALID_INPUT',
          message: 'First and last name are required'
        }, { status: 400 });
      }
      updates.first_name = trimmedFirstName;
      updates.last_name = trimmedLastName;
      updates.full_name = `${trimmedFirstName} ${trimmedLastName}`.trim();
    } else if (full_name !== undefined) {
      if (full_name.trim() === '') {
        return Response.json({
          error: 'Invalid name',
          code: 'INVALID_INPUT',
          message: 'Name cannot be empty'
        }, { status: 400 });
      }
      updates.full_name = full_name.trim();
    }

    // Profile photo is optional and non-blocking
    if (profile_photo_url !== undefined) {
      updates.profile_photo_url = profile_photo_url;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({
        error: 'No updates provided',
        code: 'INVALID_INPUT'
      }, { status: 400 });
    }

    // Update user
    await base44.auth.updateMe(updates);

    // Fetch updated user
    const updatedUser = await base44.auth.me();

    return Response.json({
      success: true,
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

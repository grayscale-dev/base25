import { useState } from 'react';
import { useWorkspaceContext } from '@/components/context/WorkspaceContext';
import ProfileCompletionModal from './ProfileCompletionModal';

/**
 * Profile Guard Hook
 *
 * Wraps write actions to enforce required first/last name profile fields.
 * 
 * Usage:
 * ```js
 * const { guardAction, ProfileGuard } = useProfileGuard();
 * 
 * const handleSubmit = async () => {
 *   await guardAction(async () => {
 *     // your write action
 *   });
 * };
 * 
 * return (
 *   <>
 *     <ProfileGuard />
 *     ...
 *   </>
 * );
 * ```
 */
export function useProfileGuard() {
  const { user, refresh: refreshContext } = useWorkspaceContext();
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const hasRequiredName = Boolean(
    user?.first_name?.trim() &&
      user?.last_name?.trim()
  );

  /**
   * Guard a write action - checks if profile is complete before executing
   */
  const guardAction = async (action) => {
    if (!hasRequiredName) {
      // Store the action and show modal
      return new Promise((resolve, reject) => {
        setPendingAction({ action, resolve, reject });
        setShowModal(true);
      });
    }

    // Profile complete - execute action directly
    return action();
  };

  /**
   * Handle profile completion - retry pending action
   */
  const handleComplete = async () => {
    setShowModal(false);

    // Refresh context to get updated user
    await refreshContext();

    // Retry the pending action
    if (pendingAction) {
      try {
        const result = await pendingAction.action();
        pendingAction.resolve(result);
      } catch (error) {
        pendingAction.reject(error);
      }
      setPendingAction(null);
    }
  };

  /**
   * Handle cancellation - reject pending action
   */
  const handleCancel = () => {
    setShowModal(false);
    
    if (pendingAction) {
      pendingAction.reject(new Error('Profile completion cancelled'));
      setPendingAction(null);
    }
  };

  /**
   * ProfileGuard component - renders the modal
   */
  const ProfileGuard = () => (
    <ProfileCompletionModal
      isOpen={showModal}
      onComplete={handleComplete}
      onCancel={handleCancel}
      initialFirstName={user?.first_name || ''}
      initialLastName={user?.last_name || ''}
    />
  );

  return {
    guardAction,
    ProfileGuard
  };
}

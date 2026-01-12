import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { boardUrl } from '@/components/utils/boardUrl';

/**
 * Legacy route redirect for /Feedback
 * Redirects to canonical board-scoped route if context exists
 */
export default function FeedbackLegacy() {
  const navigate = useNavigate();

  useEffect(() => {
    const workspace = sessionStorage.getItem('selectedBoard');
    
    if (workspace) {
      const ws = JSON.parse(workspace);
      // Redirect to canonical board-scoped route
      navigate(boardUrl(ws.slug, 'feedback'), { replace: true });
    } else {
      // No board context - show error or redirect to home
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return null;
}
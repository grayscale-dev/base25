import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { boardUrl } from '@/components/utils/boardUrl';

/**
 * Legacy route redirect for /Changelog
 * Redirects to canonical board-scoped route if context exists
 */
export default function ChangelogLegacy() {
  const navigate = useNavigate();

  useEffect(() => {
    const workspace = sessionStorage.getItem('selectedBoard');
    
    if (workspace) {
      const ws = JSON.parse(workspace);
      navigate(boardUrl(ws.slug, 'changelog'), { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return null;
}
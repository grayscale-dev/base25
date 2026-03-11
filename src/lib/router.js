"use client";

import { useEffect, useState } from 'react';
import { useParams as useNextParams, usePathname, useRouter } from 'next/navigation';

const normalizeHref = (to) => {
  if (typeof to === 'string') return to;
  if (to && typeof to === 'object') {
    const pathname = to.pathname ?? '';
    const search = to.search ?? '';
    const hash = to.hash ?? '';
    return `${pathname}${search}${hash}` || '/';
  }
  return '/';
};

export function useNavigate() {
  const router = useRouter();

  return (to, options = {}) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }

    const href = normalizeHref(to);
    if (options?.replace) {
      router.replace(href);
      return;
    }

    router.push(href);
  };
}

export function useLocation() {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [hash, setHash] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.__base25LocationPatched) {
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;
      const emitLocationChange = () => {
        window.setTimeout(() => {
          window.dispatchEvent(new Event('locationchange'));
        }, 0);
      };

      window.history.pushState = function pushStatePatched(...args) {
        const result = originalPushState.apply(this, args);
        emitLocationChange();
        return result;
      };

      window.history.replaceState = function replaceStatePatched(...args) {
        const result = originalReplaceState.apply(this, args);
        emitLocationChange();
        return result;
      };

      window.addEventListener('popstate', () => {
        emitLocationChange();
      });

      window.__base25LocationPatched = true;
    }

    const syncLocation = () => {
      const nextSearch = window.location.search || '';
      const nextHash = window.location.hash || '';
      setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
      setHash((prev) => (prev === nextHash ? prev : nextHash));
    };

    syncLocation();
    window.addEventListener('hashchange', syncLocation);
    window.addEventListener('locationchange', syncLocation);

    return () => {
      window.removeEventListener('hashchange', syncLocation);
      window.removeEventListener('locationchange', syncLocation);
    };
  }, [pathname]);

  return {
    pathname: pathname || '/',
    search,
    hash,
  };
}

export function useParams() {
  return useNextParams();
}

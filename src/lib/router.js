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
    const syncLocation = () => {
      setSearch(window.location.search || '');
      setHash(window.location.hash || '');
    };

    syncLocation();
    window.addEventListener('hashchange', syncLocation);
    window.addEventListener('popstate', syncLocation);

    return () => {
      window.removeEventListener('hashchange', syncLocation);
      window.removeEventListener('popstate', syncLocation);
    };
  }, [pathname]);

  return {
    pathname: pathname || '/',
    search: search || '',
    hash,
  };
}

export function useParams() {
  return useNextParams();
}

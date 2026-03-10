"use client";

import Layout from '@/Layout';

export default function RoutePage({ currentPageName, children }) {
  return <Layout currentPageName={currentPageName}>{children}</Layout>;
}

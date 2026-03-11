"use client";

import { QueryClientProvider } from '@tanstack/react-query';
import { PrimeReactProvider } from 'primereact/api';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import { Toaster } from '@/components/ui/toaster';

export default function AppProviders({ children }) {
  const primeReactConfig = {
    unstyled: true,
  };

  return (
    <PrimeReactProvider value={primeReactConfig}>
      <QueryClientProvider client={queryClientInstance}>
        <NavigationTracker />
        {children}
        <Toaster />
      </QueryClientProvider>
    </PrimeReactProvider>
  );
}

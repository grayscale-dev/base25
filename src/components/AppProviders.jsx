"use client";

import { QueryClientProvider } from '@tanstack/react-query';
import { PrimeReactProvider } from 'primereact/api';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider } from '@/lib/AuthContext';
import NavigationTracker from '@/lib/NavigationTracker';
import { Toaster } from '@/components/ui/toaster';
import AppAuthGate from '@/components/AppAuthGate';

export default function AppProviders({ children }) {
  const primeReactConfig = {
    unstyled: true,
  };

  return (
    <PrimeReactProvider value={primeReactConfig}>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <NavigationTracker />
          <AppAuthGate>{children}</AppAuthGate>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </PrimeReactProvider>
  );
}

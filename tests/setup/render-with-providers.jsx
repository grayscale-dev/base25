import React from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrimeReactProvider } from "primereact/api";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithProviders(ui, options = {}) {
  const queryClient = options.queryClient || createTestQueryClient();

  function Wrapper({ children }) {
    return (
      <PrimeReactProvider value={{ unstyled: true }}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </PrimeReactProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  };
}

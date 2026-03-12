import { QueryClient } from '@tanstack/react-query';
import { WORKSPACE_CACHE_STALE_TIME_MS } from '@/lib/workspace-loading';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: WORKSPACE_CACHE_STALE_TIME_MS,
			refetchOnWindowFocus: false,
			refetchOnReconnect: true,
			refetchOnMount: true,
			retry: 1,
		},
	},
});

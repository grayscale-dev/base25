import { env } from "@/lib/env";

const isNode = typeof window === 'undefined';
const storage = isNode
	? {
		getItem: () => null,
		setItem: () => { },
		removeItem: () => { },
	}
	: window.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
	const searchParam = urlParams.get(paramName);
	const hashParam = hashParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		hashParams.delete(paramName);
		const newHash = hashParams.toString();
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${newHash ? `#${newHash}` : ""}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	if (hashParam) {
		storage.setItem(storageKey, hashParam);
		return hashParam;
	}
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	const accessToken = getAppParamValue("access_token", { removeFromUrl: true });
	const legacyToken = accessToken ? null : storage.getItem('token');
	if (!accessToken && legacyToken) {
		storage.setItem('base44_access_token', legacyToken);
	}
	return {
		appId: getAppParamValue("app_id", { defaultValue: env.base44AppId }),
		token: accessToken || legacyToken,
		fromUrl: getAppParamValue("from_url", {
			defaultValue: isNode ? env.base44AppBaseUrl : window.location.href,
		}),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: env.base44FunctionsVersion }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: env.base44AppBaseUrl }),
	}
}


export const appParams = {
	...getAppParams()
}

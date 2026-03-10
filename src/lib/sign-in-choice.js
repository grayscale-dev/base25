const listeners = new Set();

export function openSignInChoice(options = {}) {
  return new Promise((resolve) => {
    if (listeners.size === 0) {
      resolve({
        ok: false,
        error: new Error("Sign-in chooser is not mounted."),
      });
      return;
    }

    const request = { options, resolve };
    listeners.forEach((listener) => listener(request));
  });
}

export function subscribeSignInChoice(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}


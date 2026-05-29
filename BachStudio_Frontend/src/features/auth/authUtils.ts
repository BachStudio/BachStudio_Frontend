export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  provider?: string;
};

export type AuthSession = {
  accessToken: string;
  tokenType: string;
  user: AuthUser | null;
};

type GoogleAuthUrlResponse = {
  authorization_url: string;
  state: string;
};

type GoogleCallbackResponse = {
  access_token: string;
  token_type: string;
  user?: AuthUser;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI ?? 'http://localhost:5173/auth/callback';
const AUTH_STORAGE_KEY = 'bach-studio-auth-session';
const GOOGLE_STATE_KEY = 'bach-studio-google-state';
const GOOGLE_RETURN_KEY = 'bach-studio-google-return';

export function getStoredAuth(): AuthSession | null {
  try {
    const rawSession = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) {
      return null;
    }

    const session = JSON.parse(rawSession) as AuthSession;
    return session.accessToken ? session : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(session: AuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('bach-studio-auth-change'));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event('bach-studio-auth-change'));
}

export function getAuthHeaders(): Record<string, string> {
  const session = getStoredAuth();
  if (!session?.accessToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.accessToken}`,
  };
}

export function isSignedIn() {
  return Boolean(getStoredAuth()?.accessToken);
}

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    return typeof payload.detail === 'string' ? payload.detail : response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function startGoogleLogin(returnTo = `${window.location.pathname}${window.location.search}`) {
  const state = crypto.randomUUID();
  const response = await fetch(`${API_BASE_URL}/auth/google/login?state=${encodeURIComponent(state)}`);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as GoogleAuthUrlResponse;
  sessionStorage.setItem(GOOGLE_STATE_KEY, payload.state);
  sessionStorage.setItem(GOOGLE_RETURN_KEY, returnTo || '/');
  window.location.href = payload.authorization_url;
}

export async function completeGoogleLogin(callbackUrl = window.location.href): Promise<{ session: AuthSession; returnTo: string }> {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = sessionStorage.getItem(GOOGLE_STATE_KEY);
  const returnTo = sessionStorage.getItem(GOOGLE_RETURN_KEY) || '/projects';

  if (!code) {
    throw new Error('Google login code is missing');
  }
  if (!state || !expectedState || state !== expectedState) {
    throw new Error('Google login state mismatch');
  }

  const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      state,
      redirectUri: GOOGLE_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as GoogleCallbackResponse;
  const session: AuthSession = {
    accessToken: payload.access_token,
    tokenType: payload.token_type,
    user: payload.user ?? null,
  };

  setStoredAuth(session);
  sessionStorage.removeItem(GOOGLE_STATE_KEY);
  sessionStorage.removeItem(GOOGLE_RETURN_KEY);

  return { session, returnTo };
}

export async function validateStoredAuth() {
  const response = await fetch(`${API_BASE_URL}/auth/validate`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    clearStoredAuth();
    return false;
  }

  return true;
}

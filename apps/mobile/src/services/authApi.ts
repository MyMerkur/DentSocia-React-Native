import axios from "axios";
import { createApiClient, type RefreshedTokens } from "@dentsocia/api-client";
import { useAuthStore } from "../store/useAuthStore";

export const API_BASE_URL = "http://localhost:4000";

export interface AuthResponse {
  user: { id: string; email: string; role: string };
  accessToken: string;
  refreshToken: string;
}

async function refreshTokens(refreshToken: string): Promise<RefreshedTokens> {
  const { data } = await axios.post<AuthResponse>(`${API_BASE_URL}/api/v1/auth/refresh`, { refreshToken });
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

export const apiClient = createApiClient({
  baseURL: API_BASE_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  refreshTokens,
  onTokensRefreshed: ({ accessToken, refreshToken }) => {
    const { user } = useAuthStore.getState();
    if (user) {
      useAuthStore.getState().setSession({ user, accessToken, refreshToken });
    }
  },
  onSessionExpired: () => {
    useAuthStore.getState().clearSession();
  },
});

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/api/v1/auth/login", { email, password });
  return data;
}

export async function register(email: string, password: string, role: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/api/v1/auth/register", { email, password, role });
  return data;
}

export async function logout(): Promise<void> {
  const { refreshToken } = useAuthStore.getState();
  if (refreshToken) {
    try {
      await apiClient.post("/api/v1/auth/logout", { refreshToken });
    } catch {
      // best-effort server-side revoke — local session is cleared regardless
    }
  }
  useAuthStore.getState().clearSession();
}

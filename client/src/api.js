const API_URL = import.meta.env.VITE_API_URL || "/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("vastram_token");
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(
      "Cannot reach the Vastram API. Make sure the backend is running with `npm run dev:server`."
    );
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}

export function saveSession({ token, user }) {
  localStorage.setItem("vastram_token", token);
  localStorage.setItem("vastram_user", JSON.stringify(user));
}

export function getStoredUser() {
  const raw = localStorage.getItem("vastram_user");
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem("vastram_token");
  localStorage.removeItem("vastram_user");
}

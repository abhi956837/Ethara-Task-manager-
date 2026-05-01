import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://ethara-task-manager-backend-production.up.railway.app";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("ttm_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getApiErrorMessage(error, fallback = "Something went wrong.") {
  if (error?.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg).join(", ");
    }
    return String(detail);
  }
  if (error?.message) {
    return error.message;
  }
  return fallback;
}

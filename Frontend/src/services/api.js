import axios from 'axios';
import { setCredentials, clearCredentials } from "../store/authSlice.js";
import Store from "../store/index.js";

const BASE_URL = import.meta.env.VITE_SERVER_URL;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // For cookie support (refreshToken)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization header if access token exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Share one refresh call between all requests that fail with 401 at the same time
let refreshPromise = null;

const refreshAccessToken = () => {
  if (!refreshPromise) {
    // Bare axios (not `api`) so this call doesn't go through the interceptor below
    refreshPromise = axios
      .post('/api/v1/auth/refresh', {}, { baseURL: BASE_URL, withCredentials: true })
      .then((res) => res.data?.data)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Response interceptor: try to refresh the token on a 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        const data = await refreshAccessToken();
        const newToken = data?.accessToken;
        if (!newToken) throw new Error('No access token in refresh response');

        const user = { userName: data.userName, email: data.email };
        localStorage.setItem('accessToken', newToken);
        Store.dispatch(setCredentials({ user, accessToken: newToken }));

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        Store.dispatch(clearCredentials());
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const authApi = {
  requestOtp: (data) => api.post('/api/v1/auth/otp-request', data),
  verifyOtp: (data) => api.post('/api/v1/auth/otp-verify', data),
  register: (data) => api.post('/api/v1/auth/register', data),
  login: (data) => api.post('/api/v1/auth/login', data),
  changePassword: (data) => api.post('/api/v1/auth/change-password', data),
  logout: () => api.post('/api/v1/auth/logout'),
  refresh: () => api.post('/api/v1/auth/refresh'),
  getCurrentUser: () => api.post('/api/v1/auth/getCurrentUser'),
};

// Quiz Services
export const quizApi = {
  saveQuiz: (data) => api.post('/api/v1/quiz/save-quiz', data),
  generateQuiz: (data) => api.post('/api/v1/quiz/generate', data),
  getLeaderboard: (quizId, limit = 50) =>
    api.get(`/api/v1/quiz/leaderboard/${quizId}?limit=${limit}`),
  getMyScore: (quizId) => api.get(`/api/v1/quiz/myScore/${quizId}`),
};

export default api;
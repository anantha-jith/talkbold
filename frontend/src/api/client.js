import axios from 'axios';

// In production (Netlify): VITE_API_BASE_URL = full Render backend URL
// In local dev: falls back to '/api' which goes through the Vite proxy → localhost:8000
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('viva_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-handle guest limit errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail || ''
    if (error.response?.status === 403 && detail.includes('Guest limit')) {
      // Toast will be shown by the calling component
      // Clear guest session so next visit goes to login
      const role = localStorage.getItem('viva_role')
      if (role === 'guest') {
        // Don't auto-logout — let the error bubble up so the component shows the message
      }
    }
    return Promise.reject(error)
  }
);

export default apiClient;

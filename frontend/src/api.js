import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach token automatically
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('pmp_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Handle 401 — clear token and reload
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pmp_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

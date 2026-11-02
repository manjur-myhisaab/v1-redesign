import axios from "axios"
export const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
})

axiosInstance.interceptors.request.use(async (config) => {
    const token = localStorage.getItem("mh.token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
})

let isRedirecting = false

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            ['mh.token', 'mh.user', 'mh.workspaces', 'mh.activeWs', 'mh.mock.db'].forEach((k) =>
                localStorage.removeItem(k)
            )
            if (window.location.pathname !== "/login" && !isRedirecting) {
                isRedirecting = true
                window.location.href = "/login"
            }
        }
        return Promise.reject(error)
    }
)

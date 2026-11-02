import { axiosInstance } from "./axiosInstance";

export const apiClient = {
    get: async (url: string) => {
        return await axiosInstance.get(url).then((response) => response.data);
    },
    post: async (url: string, data: any) => {
        return await axiosInstance.post(url, data).then((response) => response.data);
    },
    put: async (url: string, data: any) => {
        return await axiosInstance.put(url, data).then((response) => response.data);
    },
    patch: async (url: string, data?: any) => {
        return await axiosInstance.patch(url, data).then((response) => response.data);
    },
    delete: async (url: string, data?: any) => {
        return await axiosInstance.delete(url, { data }).then((response) => response.data);
    },
}

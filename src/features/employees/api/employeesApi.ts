import { apiClient } from "@/api/apiClient";
import type {
  EmployeeResponse,
  EmployeeListResponse,
  SingleEmployeeResponse,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from "../types/employeesApi.types";

export const employeesApi = {
  getEmployees: async (): Promise<EmployeeListResponse> => {
    return apiClient.get("/firm/employee/all");
  },
  getEmployeeById: async (id: string): Promise<SingleEmployeeResponse> => {
    return apiClient.get(`/firm/employee/details/${id}`);
  },
  createEmployee: async (data: CreateEmployeeRequest): Promise<SingleEmployeeResponse> => {
    return apiClient.post("/firm/employee/create", data);
  },
  updateEmployee: async (data: UpdateEmployeeRequest): Promise<SingleEmployeeResponse> => {
    return apiClient.put("/firm/employee/update", data);
  },
  deleteEmployee: async (id: string): Promise<EmployeeResponse<any>> => {
    return apiClient.delete(`/firm/employee/delete/${id}`);
  },
};

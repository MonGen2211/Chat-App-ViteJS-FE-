import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: "http://localhost:2211/api",
  withCredentials: true, // Để gửi cookie nếu có
});

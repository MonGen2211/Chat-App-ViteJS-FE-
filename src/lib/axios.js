import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: "https://chat-app-be-js-production.up.railway.app//api",
  withCredentials: true, // Để gửi cookie nếu có
});

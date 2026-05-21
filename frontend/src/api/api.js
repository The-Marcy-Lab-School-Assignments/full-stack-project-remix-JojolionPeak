import axios from "axios";

export const api = axios.create({
  baseURL:
    import.meta.env.MODE === "production"
      ? ""
      : "http://localhost:3000",

  withCredentials: true,
});
import { io } from "socket.io-client";

let socketInstance = null;

export const getRealtimeSocket = () => {
  if (socketInstance) return socketInstance;
  const token = localStorage.getItem("token");
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
  socketInstance = io(baseUrl, {
    transports: ["websocket", "polling"],
    auth: {
      token: token ? `Bearer ${token}` : "",
    },
  });
  return socketInstance;
};

export const closeRealtimeSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

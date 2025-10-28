import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import authRoutes from "../routes/auth.routes.js";
import userRoutes from "../routes/user.routes.js";
import errorHandler from "../middlewares/error.middleware.js";
import { emitSocketError } from "../utils/SocketError.js";
import { User } from "../models/user.model.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.FRONTEND_URL,
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

app.use(errorHandler);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

const onlineUsers = new Map();
const socketUserMap = new Map();

io.on("connection", (socket) => {
  console.log(" New client connected:", socket.id);

  socket.on("joinUserRoom", async (userId) => {
    try {
      if (!userId) throw new ApiError(400, "User ID is required");

      socket.join(userId);
      onlineUsers.set(userId, socket.id);
      socketUserMap.set(socket.id, userId);

      await User.findByIdAndUpdate(userId, {
        status: "online",
        lastSeen: new Date(),
      });

      socket.broadcast.emit("userStatus", { userId, status: "online" });
    } catch (error) {
      console.error(" Socket error in joinUserRoom:", error);
      emitSocketError(socket, error);
    }
  });

  socket.on("disconnect", async () => {
    const userId = socketUserMap.get(socket.id);
    if (userId) {
      try {
        onlineUsers.delete(userId);
        socketUserMap.delete(socket.id);

        await User.findByIdAndUpdate(userId, {
          status: "offline",
          lastSeen: new Date(),
        });

        io.emit("userStatus", { userId, status: "offline" });
      } catch (error) {
        console.error("Socket error in disconnect:", error);
        emitSocketError(socket, error);
      }
    }

    console.log(" Client disconnected:", socket.id);
  });

});

export { app, server };

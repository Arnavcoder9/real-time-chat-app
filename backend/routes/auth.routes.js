import express from "express";
import {
  registerUser,
  loginUser,
  logout,
  sendVerificationCode,
  verifyEmail,
  requestRecoveryCode,
  resetnewpassword,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/send-verification", sendVerificationCode);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", requestRecoveryCode);
router.put("/reset-password", resetnewpassword);
router.delete("/logout", protect, logout);

export default router;

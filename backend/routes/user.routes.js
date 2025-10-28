import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { changepassword, getcurrentUser, updateUser } from "../controllers/user.controller.js";

const router = express.Router();
router.use(protect);
router.get("/getcurrentuser", getcurrentUser);
router.patch("/update", updateUser);
router.put("/changepassword", changepassword);

export default router;

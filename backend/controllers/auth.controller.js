import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import sendEmail from "../utils/sendEmail.js";

export const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, fullName, profilePicture } = req.body;

  if (!username || !email || !password || !fullName) {
    throw new ApiError(400, "Please provide all required fields");
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    if (existingUser.isVerified) {
      throw new ApiError(409, "User with this email or username already exists");
    }
    await User.deleteOne({ _id: existingUser._id });
  }

  const newUser = await User.create({
    username,
    fullName,
    password,
    profilePicture: profilePicture || "",
    email,
  });

  if (!newUser) {
    throw new ApiError(500, "Failed to create user account");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, null, "User registered successfully"));
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ApiError(400, "Email and password are required");

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found with this email");

  if (!user.isVerified)
    throw new ApiError(403, "Please verify your email address before logging in");

  const isValidPassword = await user.isPasswordCorrect(password);
  if (!isValidPassword) throw new ApiError(401, "Invalid credentials");
  const refreshToken = user.generateRefreshToken();
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  };

  user.lastSeen = new Date();
  await user.save();

  return res
    .cookie("token", refreshToken, cookieOptions)
    .status(200)
    .json(new ApiResponse(200, { token: refreshToken }, "Login successful"));
});

export const sendVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required");

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found with this email");

  if (user.isVerified) throw new ApiError(400, "Email is already verified");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 3 * 60 * 1000);

  user.otpCode = code;
  user.otpExpires = expiry;
  await user.save();

  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
      <h2 style="color: #333;">Verify Your Email - Lets Talk</h2>
      <p style="font-size: 16px; color: #555;">
        Welcome to <strong>Lets Talk</strong>! Please verify your email address using the verification code below:
      </p>
      <p style="font-size: 22px; font-weight: bold; color: #2c3e50; background-color: #eaf2f8; padding: 10px 15px; display: inline-block; border-radius: 4px;">
        ${code}
      </p>
      <p style="font-size: 14px; color: #888; margin-top: 10px;">
        This verification code will expire in <strong>3 minutes</strong>. If you didn’t request this, you can safely ignore this email.
      </p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
      <p style="font-size: 12px; color: #aaa;">
        For your security, never share this code with anyone. The Lets Talk team will never ask for it.
      </p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: "Email Verification Code - Lets Talk",
      message: `Your verification code is ${code}. It will expire in 3 minutes.`,
      html: htmlMessage,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Verification code sent successfully"));
  } catch (error) {
    console.error("Email Error:", error);
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(500, "Email could not be sent. Please try again later.");
  }
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code)
    throw new ApiError(400, "Email and verification code are required");

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found with this email");

  if (user.isVerified) throw new ApiError(400, "Email is already verified");
  if (!user.otpCode || new Date() > user.otpExpires)
    throw new ApiError(400, "Verification code has expired");
  if (user.otpCode !== code)
    throw new ApiError(401, "Invalid verification code");

  user.isVerified = true;
  user.otpCode = undefined;
  user.otpExpires = undefined;
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Email verified successfully"));
});

export const logout = asyncHandler(async (req, res) => {
  const _id = req.user?._id;
  if (_id) {
    const user = await User.findById(_id);
    if (user) {
      user.status = "offline";
      user.lastSeen = new Date();
      await user.save();
    }
  }

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  };

  return res
    .clearCookie("token", cookieOptions)
    .status(200)
    .json(new ApiResponse(200, null, "Logged out successfully"));
});

export const requestRecoveryCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required");

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found");

  const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

  user.passwordResetToken = recoveryCode;
  user.passwordResetExpires = expiresAt;
  await user.save();

  const htmlMessage = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
    <h2 style="color: #333;">Password Recovery Code</h2>
    <p style="font-size: 16px; color: #555;">
      We received a request to reset your password on <strong>Lets Talk</strong>.
      Please use the following code to verify your request:
    </p>
    <p style="font-size: 22px; font-weight: bold; color: #2c3e50; background-color: #eaf2f8; padding: 10px 15px; display: inline-block; border-radius: 4px;">
      ${recoveryCode}
    </p>
    <p style="font-size: 14px; color: #888; margin-top: 10px;">
      This code will expire in <strong>3 minutes</strong>. If you did not request this, please ignore this email.
    </p>
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
    <p style="font-size: 12px; color: #aaa;">
      For your security, never share this code with anyone. Our team will never ask for it.
    </p>
  </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Recovery Code - Lets Talk",
      message: `Your verification code is ${recoveryCode}. It will expire in 3 minutes.`,
      html: htmlMessage,
    });

    res
      .status(200)
      .json(new ApiResponse(200, null, "Recovery code sent successfully"));
  } catch (error) {
    console.error("Email Error:", error);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(500, "Email could not be sent. Please try again later.");
  }
});

export const resetnewpassword = asyncHandler(async (req, res) => {
  const { email, verificationCode, newPassword } = req.body;

  if (!email || !verificationCode || !newPassword)
    throw new ApiError(400, "Email, verification code, and new password are required");

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found");

  if (user.passwordResetToken !== verificationCode)
    throw new ApiError(400, "Invalid verification code");

  if (user.passwordResetExpires < Date.now())
    throw new ApiError(400, "Recovery code has expired");

  user.password = newPassword;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Password reset successfully"));
});

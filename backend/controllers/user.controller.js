import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";

export const getcurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await User.findById(userId).select(
    "username email fullName profilePicture bio"
  );
  if (!user) throw new ApiError(404, "User not found");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User retrieved successfully"));
});

export const changepassword = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    throw new ApiError(400, "Please enter both current and new password");
  if (newPassword.length < 6)
    throw new ApiError(400, "Password must be at least 6 characters long");

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const isValidPassword = await user.isPasswordCorrect(currentPassword);
  if (!isValidPassword) throw new ApiError(400, "Invalid current password");

  user.password = newPassword;
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Password changed successfully"));
});

export const updateUser = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const updateData = req.body;
  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User profile updated successfully"));
});



















export const getUsers = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { term } = req.body;
  const currentUser = await User.findById(userId).select("blockedUsers");

  if (!currentUser) throw new ApiError(404, "User not found");

  let users;

  const blockedFilter = {
    $and: [
      { _id: { $ne: userId } },
      { _id: { $nin: currentUser.blockedUsers } },
      { blockedUsers: { $ne: userId } },
    ],
  };

  if (term && term.trim() !== "") {
    users = await User.find({
      $and: [
        ...blockedFilter.$and,
        {
          $or: [
            { username: { $regex: term, $options: "i" } },
            { email: { $regex: term, $options: "i" } },
            { fullName: { $regex: term, $options: "i" } },
          ],
        },
      ],
    })
      .select("username email fullName profilePicture status lastSeen")
      .limit(10);
  } else {
    users = await User.aggregate([
      {
        $match: {
          $and: [
            { _id: { $ne: userId } },
            {
              _id: {
                $nin: currentUser.blockedUsers.map(
                  (id) => new mongoose.Types.ObjectId(id)
                ),
              },
            },
            { blockedUsers: { $ne: new mongoose.Types.ObjectId(userId) } },
          ],
        },
      },
      { $sample: { size: 5 } },
      {
        $project: {
          username: 1,
          email: 1,
          fullName: 1,
          profilePicture: 1,
          status: 1,
          lastSeen: 1,
        },
      },
    ]);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, users, "Users retrieved successfully"));
});
import ApiError from "./ApiError.js";

export const emitSocketError = (socket, error) => {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(500, "Internal server error");

  socket.emit("errorEvent", {
    statusCode: apiError.statusCode,
    message: apiError.message,
    success: false,
  });
};
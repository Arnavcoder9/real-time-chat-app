import ApiError from "../utils/ApiError.js";

const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Something went wrong",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(", "),
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return res.status(409).json({
      success: false,
      message: `${field} already exists.`,
    });
  }

  return res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;

import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';

const notFound: RequestHandler = (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'Route not found',
    errorMessages: [{ path: req.originalUrl, message: `Cannot ${req.method} ${req.originalUrl}` }],
  });
};

export default notFound;

import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getUserId } from '../../../helpers/requestUser.js';
import sendResponse from '../../../shared/sendResponse.js';
import { dashboardService } from './dashboard.service.js';

const getSummary: RequestHandler = async (req, res) => {
  const summary = await dashboardService.getSummary(getUserId(req));

  sendResponse(res, { statusCode: StatusCodes.OK, data: summary });
};

export const dashboardController = {
  getSummary,
};

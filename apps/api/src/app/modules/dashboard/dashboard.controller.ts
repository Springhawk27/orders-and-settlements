import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getUserId } from '../../../helpers/requestUser';
import sendResponse from '../../../shared/sendResponse';
import { dashboardService } from './dashboard.service';

const getSummary: RequestHandler = async (req, res) => {
  const summary = await dashboardService.getSummary(getUserId(req));

  sendResponse(res, { statusCode: StatusCodes.OK, data: summary });
};

export const dashboardController = {
  getSummary,
};

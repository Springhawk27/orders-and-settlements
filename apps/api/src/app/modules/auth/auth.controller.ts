import type { LoginInput, RegisterInput } from '@crossval/shared';
import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getUserId } from '../../../helpers/requestUser';
import sendResponse from '../../../shared/sendResponse';
import { authService } from './auth.service';
import { clearAuthCookies, readRefreshToken, setAuthCookies } from './auth.utils';

const register: RequestHandler = async (req, res) => {
  const { user, tokens } = await authService.register(req.body as RegisterInput);

  setAuthCookies(res, tokens);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Account created',
    data: user,
  });
};

const login: RequestHandler = async (req, res) => {
  const { user, tokens } = await authService.login(req.body as LoginInput);

  setAuthCookies(res, tokens);
  sendResponse(res, { statusCode: StatusCodes.OK, message: 'Signed in', data: user });
};

const refresh: RequestHandler = async (req, res) => {
  const { user, tokens } = await authService.refresh(readRefreshToken(req));

  setAuthCookies(res, tokens);
  sendResponse(res, { statusCode: StatusCodes.OK, message: 'Session refreshed', data: user });
};

const logout: RequestHandler = async (req, res) => {
  await authService.logout(readRefreshToken(req));

  clearAuthCookies(res);
  sendResponse(res, { statusCode: StatusCodes.OK, message: 'Signed out', data: null });
};

const getCurrentUser: RequestHandler = async (req, res) => {
  const user = await authService.getCurrentUser(getUserId(req));

  sendResponse(res, { statusCode: StatusCodes.OK, data: user });
};

export const authController = {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
};

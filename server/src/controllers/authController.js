import { env } from '../config/env.js';
import {
  getCurrentUser,
  getRefreshCookieOptions,
  login,
  logout,
  refresh,
  register,
} from '../services/authService.js';
import { validateLoginInput, validateRegisterInput } from '../validators/authValidator.js';

function metadata(request) {
  return {
    userAgent: request.get('user-agent')?.slice(0, 1000),
    ipAddress: request.ip,
  };
}

function setRefreshCookie(response, refreshToken) {
  response.cookie(env.authCookieName, refreshToken, getRefreshCookieOptions());
}

export async function registerController(request, response, next) {
  try {
    const result = await register(validateRegisterInput(request.body), metadata(request));
    setRefreshCookie(response, result.refreshToken);
    response.status(201).json({ data: { user: result.user, accessToken: result.accessToken }, meta: {}, error: null });
  } catch (error) {
    next(error);
  }
}

export async function loginController(request, response, next) {
  try {
    const result = await login(validateLoginInput(request.body), metadata(request));
    setRefreshCookie(response, result.refreshToken);
    response.status(200).json({ data: { user: result.user, accessToken: result.accessToken }, meta: {}, error: null });
  } catch (error) {
    next(error);
  }
}

export async function refreshController(request, response, next) {
  try {
    const result = await refresh(request.cookies?.[env.authCookieName], metadata(request));
    setRefreshCookie(response, result.refreshToken);
    response.status(200).json({ data: { user: result.user, accessToken: result.accessToken }, meta: {}, error: null });
  } catch (error) {
    next(error);
  }
}

export async function logoutController(request, response, next) {
  try {
    await logout(request.cookies?.[env.authCookieName]);
    response.clearCookie(env.authCookieName, {
      ...getRefreshCookieOptions(),
      maxAge: undefined,
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function meController(request, response, next) {
  try {
    const user = await getCurrentUser(request.auth.userId);
    response.status(200).json({ data: { user }, meta: {}, error: null });
  } catch (error) {
    next(error);
  }
}

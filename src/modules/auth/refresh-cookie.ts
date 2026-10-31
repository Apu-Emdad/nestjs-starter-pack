import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

/**
 * httpOnly: JavaScript can't read it, so XSS can't steal it.
 * secure: HTTPS only in production. sameSite strict: never sent from other sites.
 * path /auth: only sent to the auth endpoints, not to every API call.
 */
export const refreshCookieOptions = (isProduction: boolean): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/auth',
});

export const setRefreshCookie = (
  res: Response,
  token: string,
  maxAgeSeconds: number,
  isProduction: boolean,
) => {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions(isProduction),
    maxAge: maxAgeSeconds * 1000,
  });
};

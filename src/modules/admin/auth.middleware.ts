import { Request, Response, NextFunction } from 'express'
import passport from 'passport'
import httpStatus from 'http-status'
import ApiError from '../errors/ApiError'
import { IAdminDoc } from './admin.interfaces'

const verifyCallback =
  (req: Request, resolve: any, reject: any) =>
    async (err: Error, user: IAdminDoc, info: string) => {
      if (err || info || !user) {
        return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'))
      }
      req.admin = user

      resolve()
    }

const authMiddleware =
  () =>
    async (req: Request, res: Response, next: NextFunction) =>
      new Promise<void>((resolve, reject) => {
        passport.authenticate('jwt-admin', { session: false }, verifyCallback(req, resolve, reject))(req, res, next)
      })
        .then(() => next())
        .catch((err) => next(err))

export default authMiddleware

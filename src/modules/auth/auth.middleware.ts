import { Request, Response, NextFunction } from 'express'
import passport from 'passport'
import httpStatus from 'http-status'
import ApiError from '../errors/ApiError'
import { IUserDoc } from '../user/user.interfaces'
import Teams from '../teams/model.teams'

const verifyCallback =
  (req: Request, resolve: any, reject: any) =>
    async (err: Error, user: IUserDoc, info: string) => {
      if (err || info || !user) {
        return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'))
      }
      req.user = user

      const team = await Teams.findById(user.team).select('status').exec();

      if (team && team.status === 'DEACTIVATED') {
            return reject(new ApiError(httpStatus.FORBIDDEN, 'Your account has been deactivated. Please contact your account manager to get it reactivated.'))
      }
      resolve()
    }

const authMiddleware =
  () =>
    async (req: Request, res: Response, next: NextFunction) =>
      new Promise<void>((resolve, reject) => {
        passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject))(req, res, next)
      })
        .then(() => next())
        .catch((err) => next(err))

export default authMiddleware

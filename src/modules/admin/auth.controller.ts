import httpStatus from 'http-status'
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { tokenService } from '../token'
import * as authService from './auth.services'
import { agenda } from '../scheduler'
import { SEND_FORGOT_PASSWORD_EMAIL } from '../scheduler/MessageTypes'
import { SEND_VERIFICATION_MESSAGE } from '../scheduler/jobs/sendMessage'

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body
  const user = await authService.loginUserWithEmailAndPassword(email, password)
  const tokens = await tokenService.generateAuthTokens(user)
  res.send({ user, tokens })
})

export const logout = catchAsync(async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken)
  res.status(httpStatus.NO_CONTENT).send()
})

export const refreshTokens = catchAsync(async (req: Request, res: Response) => {
  const userWithTokens = await authService.refreshAuth(req.body.refreshToken)
  res.send({ ...userWithTokens })
})

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { resetPasswordToken, user } = await tokenService.generateResetPasswordTokenAdmin(req.body.email)
  agenda.now<SEND_VERIFICATION_MESSAGE>(SEND_FORGOT_PASSWORD_EMAIL, {
    code: resetPasswordToken, name: user.name, email: user.email, admin: true
  })
  res.status(httpStatus.NO_CONTENT).send()
})

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await authService.resetPassword(req.query['token'], req.body.password)
  res.status(httpStatus.NO_CONTENT).send()
})

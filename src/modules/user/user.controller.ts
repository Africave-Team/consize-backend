import httpStatus from 'http-status'
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
// import ApiError from '../errors/ApiError'
import * as userService from './user.service'


export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    await userService.deleteUserById(req.params['userId'])
    res.status(httpStatus.NO_CONTENT).send()
  }
})

export const updateProfileInfo = catchAsync(async (req: Request, res: Response) => {
  await userService.updateUserById(req.user.id, req.body)
  res.status(httpStatus.NO_CONTENT).send()
})


export const getProfileInfo = catchAsync(async (req: Request, res: Response) => {
  res.status(200).json(req.user)
})

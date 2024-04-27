import httpStatus from 'http-status'
import { Request, Response } from 'express'
import { catchAsync } from '../utils'


export const SlackWebhookHandler = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body
  console.log(payload)
  res.status(httpStatus.OK).send()
})
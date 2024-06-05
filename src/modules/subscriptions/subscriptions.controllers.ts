import { Request, Response } from 'express'
import { subscriptionService } from '.'
import { catchAsync } from '../utils'


export const seedPlans = catchAsync(async (_: Request, res: Response) => {
  await subscriptionService.seedSubscriptionPlans()
  return res.status(200).json({ message: "Plans have been seeded" })
})


export const fetchPlans = catchAsync(async (_: Request, res: Response) => {
  const plans = await subscriptionService.fetchSubscriptionPlans()
  return res.status(200).json({ message: "Available plans", data: plans })
})


export const myActiveSubscription = catchAsync(async (req: Request, res: Response) => {
  const subscription = await subscriptionService.fetchMyActiveSubscription(req.user.team)
  return res.status(200).json({ message: "Your active subscription", data: subscription })
})


export const subscribeClient = catchAsync(async (req: Request, res: Response) => {
  const { numberOfMonths, planId } = req.body
  const subscription = await subscriptionService.subscribeClient({ numberOfMonths, planId }, req.user.team)
  return res.status(200).json({ message: "Your subscription was successfull", data: subscription })
})
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { IUserDoc } from '../user/user.interfaces'
import { userService } from '../user'
import { tokenService } from '../token'
import { emailService } from '../email'
import { teamService } from '../teams'
import httpStatus from 'http-status'
import { FetchApiInterface } from './admin.interfaces'
import { subscriptionService } from '../subscriptions'

export const enrollCompany = catchAsync(async (req: Request, res: Response) => {
  const { email, companyName, name } = req.body
  let user: IUserDoc | null = await userService.registerUser({
    email, name, password: "GENERIC123Password"
  })
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user)
  emailService.sendOnboardingEmail(user.email, user.name.split(' ')[0] || 'customer', verifyEmailToken)
  const team = await teamService.createTeam(companyName, user._id)
  await userService.updateUserById(user.id, { team: team._id })
  const plans = await subscriptionService.fetchSubscriptionPlans()
  let freeplan = plans.find(e => e.price === 0)
  if (freeplan) {
    await subscriptionService.subscribeClient({
      planId: freeplan.id,
      numberOfMonths: 24
    }, team.id)
  }
  res.status(httpStatus.CREATED).send({ message: "Company onboarded successfully" })
})


export const resendOnboardEmail = catchAsync(async (req: Request, res: Response) => {
  const { teamId } = req.params
  if (teamId) {
    const team = await teamService.fetchTeamByIdWithOwner(teamId)
    if (team) {
      const verifyEmailToken = await tokenService.generateVerifyEmailToken(team.owner)
      console.log(verifyEmailToken)
      emailService.sendOnboardingEmail(team.owner.email, team.owner.name.split(' ')[0] || 'customer', verifyEmailToken)
    }
    res.status(httpStatus.OK).send({ message: "Company onboarded successfully", data: team })
  }
})


export const fetchCompanies = catchAsync(async (req: Request, res: Response) => {
  const { search, page, pageSize }: FetchApiInterface = req.query as FetchApiInterface
  let query = {
    search,
    page: parseInt(page || '1'),
    pageSize: parseInt(pageSize || '20')
  }

  const teams = await teamService.fetchTeams(query)

  res.status(httpStatus.OK).send({ message: "Companies", ...teams })
})


export const transferCompanyOwnership = catchAsync(async (req: Request, res: Response) => {
  const { teamId } = req.params
  if (teamId) {
    const { email, name } = req.body
    const company = await teamService.fetchTeamById(teamId)
    if (company) {
      await userService.updateUserById(company.owner, {
        email, name
      })
      const verifyEmailToken = await tokenService.generateResetPasswordToken(email)
      emailService.sendResetPasswordEmail(email, verifyEmailToken.resetPasswordToken, name.split(' ')[0] || 'customer',)
    }
    res.status(httpStatus.CREATED).send({ message: "Company transfered successfully" })
  }
})
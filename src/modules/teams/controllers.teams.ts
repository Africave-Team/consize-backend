import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import * as teamService from './service.teams'
import httpStatus from 'http-status'
import { emailService } from '../email'
import { tokenService } from '../token'
import { userService } from '../user'
import { authService } from '../auth'
import { SEND_TEAM_INVITATION } from '../scheduler/MessageTypes'
import { SEND_VERIFICATION_MESSAGE } from '../scheduler/jobs/sendMessage'
import { agenda } from '../scheduler'

export const fetchTeamMembers = catchAsync(async (req: Request, res: Response) => {
  let teamMembers = await teamService.fetchTeamMembersById(req.user.team, req.user.id, parseInt(req.query['page'] as string, 10) || 1)
  return res.status(200).json(teamMembers)
})


export const inviteTeamMembers = catchAsync(async (req: Request, res: Response) => {
  const detail = await teamService.createInvitedMember(req.user.team, req.body)
  const { resetPasswordToken: token } = await tokenService.generateResetPasswordToken(detail.email)
  const team = await teamService.fetchTeamById(req.user.team)
  agenda.now<SEND_VERIFICATION_MESSAGE>(SEND_TEAM_INVITATION, {
    code: token, name: detail.name, email: detail.email, teamName: team?.name || "Consize"
  })
  res.status(httpStatus.NO_CONTENT).send()
})

export const resendInvite = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.body.userId)
  if (user) {
    const { resetPasswordToken: token } = await tokenService.generateResetPasswordToken(user.email)
    const team = await teamService.fetchTeamById(req.user.team)
    emailService.sendTeamInvitationEmail(user.email, user.name.split(' ')[0] || 'Member', team?.name || 'Consize', token)
  }
  res.status(httpStatus.NO_CONTENT).send()
})

export const removeTeamMember = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    const user = await userService.getUserById(req.params['userId'])
    if (user) {
      await userService.deleteUserById(user.id)
      // const token = await tokenService.generateResetPasswordToken(user.email)
      // const team = await teamService.fetchTeamById(req.user.team)
      // emailService.sendTeamInvitationEmail(user.email, user.name.split(' ')[0] || 'Member', team?.name || 'Consize', token)
    }
    res.status(httpStatus.NO_CONTENT).send()
  }
})

export const acceptTeamInvite = catchAsync(async (req: Request, res: Response) => {
  const user = await authService.acceptInvite(req.body.token, req.body.password)
  const tokens = await tokenService.generateAuthTokens(user)
  const team = await teamService.fetchTeamById(user.team)
  res.send({ user, tokens, team })
})

export const updateTeamInfo = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['teamId'] === 'string') {
    const team = await teamService.updateTeamInfo(req.params["teamId"], req.body)
    res.status(httpStatus.OK).send({ data: team })
  }
})

export const fetchTeamInfo = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['teamId'] === 'string') {
    const team = await teamService.fetchTeamInfo(req.params["teamId"])
    res.status(httpStatus.OK).send({ data: team })
  }
})


export const resolveTeamInfo = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['code'] === 'string') {
    const team = await teamService.resolveTeamWithShortcode(req.params["code"])
    res.status(httpStatus.OK).send({ data: team })
  }
})

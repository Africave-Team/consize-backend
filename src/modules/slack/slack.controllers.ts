import httpStatus from 'http-status'
import { Request, Response } from 'express'
import { catchAsync } from '../utils'
import { slackServices } from '.'
import { teamService } from '../teams'
import { FetchChannels, Fetchmembers } from './interfaces.slack'


export const SlackWebhookChallengeHandler = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body
  res.status(httpStatus.OK).send(payload.challenge)
})


export const SlackWebhookHandler = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body
  res.status(httpStatus.OK).send(payload.challenge)
})

export const SlackTokenExchange = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body
  await slackServices.handleSlackTokenExchange(payload.code, req.user.team)
  const team = await teamService.fetchTeamById(req.user.team)
  res.status(httpStatus.OK).send({ message: "Slack access has been saved.", data: team })
})

export const FetchSlackChannels = catchAsync(async (req: Request, res: Response) => {
  const team = await teamService.fetchTeamById(req.user.team)
  let items: FetchChannels = {
    channels: [],
    response_metadata: {
      next_cursor: ''
    }
  }
  if (team && team.slackToken) {
    items = await slackServices.fetchSlackChannels(team.slackToken)
  }
  res.status(httpStatus.OK).send({ message: "Slack access has been saved.", data: items })
})

export const FetchSlackMembers = catchAsync(async (req: Request, res: Response) => {
  const team = await teamService.fetchTeamById(req.user.team)
  let items: Fetchmembers = {
    members: [],
    response_metadata: {
      next_cursor: ''
    }
  }
  if (team && team.slackToken) {
    items = await slackServices.fetchSlackMembers(team.slackToken)
  }
  res.status(httpStatus.OK).send({ message: "Slack access has been saved.", data: items })
})


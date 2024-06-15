import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { SurveyServices } from '.'

export const createSurveyController = catchAsync(async (req: Request, res: Response) => {
  const survey = await SurveyServices.createSurvey(req.body, req.user.team)
  res.status(200).send({ message: "Survey created", data: survey })
})

export const fetchTeamSurveysController = catchAsync(async (req: Request, res: Response) => {
  const surveys = await SurveyServices.fetchTeamSurveys(req.user.team)
  res.status(200).send({ message: "Survey created", data: surveys })
})

export const createSurveyQuestion = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  if (id) {
    const survey = await SurveyServices.addQuestion(req.body, id)
    res.status(200).send({ message: "Survey created", data: survey })
  }
})

export const deleteSurvey = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  if (id) {
    await SurveyServices.deleteSurvey(id)
    res.status(200).send({ message: "Survey deleted" })
  }
})


export const updateSurvey = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  if (id) {
    const survey = await SurveyServices.updateSurvey(req.body, id)
    res.status(200).send({ message: "Survey updated", data: survey })
  }
})


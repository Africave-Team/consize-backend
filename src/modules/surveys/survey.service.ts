// import { ApiError } from '../errors'
// import httpStatus from 'http-status'
import { CreateSurveyPayload, Question, SurveyInterface } from './survey.interfaces'
import Surveys from './survey.model'

export const createSurvey = async (surveyPayload: CreateSurveyPayload, teamId: string): Promise<SurveyInterface> => {
  const survey = await Surveys.create({ ...surveyPayload, team: teamId })
  return survey
}

export const addQuestion = async (question: Omit<Question, "id">, surveyId: string): Promise<SurveyInterface | null> => {
  await Surveys.findByIdAndUpdate(surveyId, { $push: { questions: { ...question } } })
  return Surveys.findById(surveyId)
}

export const fetchTeamSurveys = async (team: string): Promise<SurveyInterface[]> => {
  return Surveys.find({ team })
}
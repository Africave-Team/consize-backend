// import { ApiError } from '../errors'
// import httpStatus from 'http-status'
import { CreateSurveyPayload, Question, SurveyInterface } from './survey.interfaces'
import Surveys from './survey.model'

export const createSurvey = async (surveyPayload: CreateSurveyPayload, teamId: string): Promise<SurveyInterface> => {
  const survey = await Surveys.create({ ...surveyPayload, team: teamId })
  return survey
}

export const updateSurvey = async (surveyPayload: CreateSurveyPayload, id: string): Promise<SurveyInterface | null> => {
  const survey = await Surveys.findByIdAndUpdate(id, { $set: { ...surveyPayload } })
  return survey
}

export const deleteSurvey = async (id: string): Promise<void> => {
  await Surveys.findByIdAndDelete(id)
}

export const addQuestion = async (question: Omit<Question, "id">, surveyId: string): Promise<SurveyInterface | null> => {
  await Surveys.findByIdAndUpdate(surveyId, { $push: { questions: { ...question } } })
  return Surveys.findById(surveyId)
}

export const fetchTeamSurveys = async (team: string): Promise<SurveyInterface[]> => {
  return Surveys.find({ team })
}
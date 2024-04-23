import Joi from 'joi'
import { CreateSurveyPayload, Question, ResponseType } from './survey.interfaces'

export const createSurvey: Record<keyof CreateSurveyPayload, any> = {
  title: Joi.string().required(),
}

export const createQuestion: Record<keyof Omit<Question, "id">, any> = {
  question: Joi.string().required(),
  choices: Joi.array().items(Joi.string()).min(1),
  responseType: Joi.string().valid(...Object.values(ResponseType))
}
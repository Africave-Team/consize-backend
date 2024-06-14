import Joi from 'joi'
import { CreateSurveyPayload, Question, ResponseType } from './survey.interfaces'

export const createSurvey: Record<keyof CreateSurveyPayload, any> = {
  title: Joi.string().required(),
  questions: Joi.array().items(Joi.object().keys({
    question: Joi.string().required(),
    choices: Joi.array().items(Joi.string()).when('responseType', {
      is: ResponseType.MULTI_CHOICE,
      then: Joi.array().min(3).messages({
        'array.min': 'Provide three choices for the user to select from'
      }),
      otherwise: Joi.array().min(0)
    }),
    responseType: Joi.string().valid(...Object.values(ResponseType)).messages({
      'any.only': 'Select a valid response type'
    })
  }))
}

export const createQuestion: Record<keyof Omit<Question, "id">, any> = {
  question: Joi.string().required(),
  choices: Joi.array().items(Joi.string()).when('responseType', {
    is: ResponseType.MULTI_CHOICE,
    then: Joi.array().min(3).messages({
      'array.min': 'Provide three choices for the user to select from'
    }),
    otherwise: Joi.array().min(0)
  }),
  responseType: Joi.string().valid(...Object.values(ResponseType)).messages({
    'any.only': 'Select a valid response type'
  })
}
import Joi from 'joi'
import { CreateCohortInterface } from './interface.cohorts'
import { Distribution } from '../courses/interfaces.courses'

const createCohortsRequest: Record<keyof CreateCohortInterface, any> = {
  name: Joi.string().required(),
  schedule: Joi.boolean().required(),
  courseId: Joi.string().required(),

  students: Joi.when("distribution", {
    is: Distribution.WHATSAPP,
    then: Joi.array().items(Joi.string()).min(1),
    otherwise: Joi.array().min(0).optional()
  }),
  channels: Joi.when("distribution", {
    is: Distribution.SLACK,
    then: Joi.array().items(Joi.string()).min(0),
    otherwise: Joi.array().min(0).optional()
  }),
  members: Joi.when("distribution", {
    is: Distribution.SLACK,
    then: Joi.array().items(Joi.string()).min(0),
    otherwise: Joi.array().min(0).optional()
  }),
  date: Joi.when("schedule", {
    is: true,
    then: Joi.date().required(),
    otherwise: Joi.optional()
  }),
  time: Joi.when("schedule", {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.optional()
  }),
  distribution: Joi.string().required().valid(...Object.values(Distribution))
}

export const createCohorts = {
  body: Joi.object().keys(createCohortsRequest),
}
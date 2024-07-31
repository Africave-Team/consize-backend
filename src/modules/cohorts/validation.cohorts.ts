import Joi from 'joi'
import { CreateCohortInterface, EnrollCohortInterface } from './interface.cohorts'
import { Distribution } from '../courses/interfaces.courses'

const createCohortsRequest: Record<keyof CreateCohortInterface, any> = {
  name: Joi.string().required(),
  courseId: Joi.string().required(),
  distribution: Joi.string().required().valid(...Object.values(Distribution))
}


const enrollCohortsRequest: Record<keyof EnrollCohortInterface, any> = {
  schedule: Joi.boolean().required(),
  courseId: Joi.string().required(),
  cohortId: Joi.string().required(),
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
  })
}

export const createCohorts = {
  body: Joi.object().keys(createCohortsRequest),
}

export const enrollCohorts = {
  body: Joi.object().keys(enrollCohortsRequest),
}
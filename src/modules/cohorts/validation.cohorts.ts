import Joi from 'joi'
import { CreateCohortInterface } from './interface.cohorts'

const createCohortsRequest: Record<keyof CreateCohortInterface, any> = {
    name: Joi.string().required(),
    courseId: Joi.string().required(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
}

export const createCohorts = {
  body: Joi.object().keys(createCohortsRequest),
}
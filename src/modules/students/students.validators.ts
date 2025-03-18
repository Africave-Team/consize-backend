import Joi from 'joi'


export const fetchStudent = {
  query: Joi.object().keys({
    phoneNumber: Joi.string().required().description("Student phone number"),
    teamId: Joi.string().required().description("Specify the team"),
  }),
}

export const confirmStudentPhoneNumber = {
  body: Joi.object().keys({
    code: Joi.string().required().description("OTP code"),
    teamId: Joi.string().required().description("Specify the team"),
  }),
}

export const enrollStudent = {
  body: Joi.object().keys({
    course: Joi.string().required().description("course id"),
    custom: Joi.object(),
    cohortId: Joi.string()
  }),
  params: Joi.object().keys({
    student: Joi.string().required().description("student id"),
  }),
}

export const registerStudent = {
  body: Joi.object().keys({
    phoneNumber: Joi.string().required().description("Student phone number"),
    email: Joi.string().required(),
    firstName: Joi.string().required(),
    otherNames: Joi.string().required(),
    tz: Joi.string().required(),
    teamId: Joi.string().required().description("Specify the team"),
    custom: Joi.object().optional().unknown(true)
  }),
}

export const fetchStudentByCourse = {
  params: Joi.object().keys({
    course: Joi.string().required().description("course id"),
  }),
}
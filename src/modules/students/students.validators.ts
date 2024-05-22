import Joi from 'joi'


export const fetchStudent = {
  query: Joi.object().keys({
    phoneNumber: Joi.string().required().description("Student phone number"),
  }),
}

export const confirmStudentPhoneNumber = {
  body: Joi.object().keys({
    code: Joi.string().required().description("OTP code"),
  }),
}

export const enrollStudent = {
  body: Joi.object().keys({
    course: Joi.string().required().description("course id"),
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
    custom: Joi.object().optional().unknown(true)
  }),
}

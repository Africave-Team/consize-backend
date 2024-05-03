import Joi from 'joi'

export const enroll = {
  body: Joi.object().keys({
    email: Joi.string().required(),
    name: Joi.string().required(),
    companyName: Joi.string().required(),
  }),
}

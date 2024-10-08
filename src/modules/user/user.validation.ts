import Joi from 'joi'
import { password, objectId } from '../validate/custom.validation'
import { NewAccount } from '../auth/auth.validation'

const createUserBody: Record<keyof NewAccount, any> = {
  email: Joi.string().required().email(),
  password: Joi.string().required().custom(password),
  name: Joi.string().required(),
  companyName: Joi.string().required()
}

export const createUser = {
  body: Joi.object().keys(createUserBody),
}

export const getUsers = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
}

export const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
}

export const updateUser = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      name: Joi.string(),
    })
    .min(1),
}



export const updateUserPassword = {
  body: Joi.object()
    .keys({
      oldPassword: Joi.string().custom(password),
      newPassword: Joi.string().custom(password)
    })
    .min(1),
}

export const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
}

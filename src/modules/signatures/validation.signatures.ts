import Joi from 'joi'
import { CreateSignatureInterface,UpdateSignatureInterface } from './interface.signatures'

const createSignatureRequest: Record<keyof CreateSignatureInterface, any> = {
  name: Joi.string().required(),
  email: Joi.string().required(),
  position: Joi.string().required(),

}

export const createSignature = {
  body: Joi.object().keys(createSignatureRequest),
}

const updateSignatureRequest: Record<keyof UpdateSignatureInterface, any> = {
  signature: Joi.string().required(),
}

export const updateSignature = {
  body: Joi.object().keys(updateSignatureRequest),
}
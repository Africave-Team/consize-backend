import Joi from 'joi'
import { CreateCertificatesInterface, CertificatesStatus } from './interface.certificates'

const createCertificatesRequest: Record<keyof CreateCertificatesInterface, any> = {
  template: Joi.string().required(),
  colors: Joi.array().items(Joi.string()).min(1),
  text: Joi.array().items(Joi.string()).min(1),
  status: Joi.string().valid(CertificatesStatus),
  signatories: Joi.array().items(Joi.string()).min(1)
}

export const updateCertificates = {
  body: Joi.object<Partial<CreateCertificatesInterface>>().keys({
    template: Joi.string().required(),
    colors: Joi.array().items(Joi.string()).min(1),
    text: Joi.array().items(Joi.string()).min(1),
    status: Joi.string().valid(CertificatesStatus),
    signatories: Joi.array().items(Joi.string()).min(1)
  })
};

export const createCertificates = {
  body: Joi.object().keys(createCertificatesRequest),
}


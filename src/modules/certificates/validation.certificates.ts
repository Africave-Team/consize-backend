import Joi from 'joi'
import { CertificatesInterface, CertificatesStatus } from './interface.certificates'

const createCertificatesRequest: Record<keyof Pick<CertificatesInterface, "name" | "status" | "signatories">, any> = {
  name: Joi.string().required(),
  status: Joi.string().valid(...Object.values(CertificatesStatus)),
  signatories: Joi.array().items(Joi.string()).required().max(2).min(1)
}

export const updateCertificates = {
  body: Joi.object<Partial<Pick<CertificatesInterface, "name" | "status" | "signatories">>>().keys({
    name: Joi.string().required(),
    status: Joi.string().valid(...Object.values(CertificatesStatus)),
    signatories: Joi.array().items(Joi.string()).required().max(2).min(1)
  })
}

export const createCertificates = {
  body: Joi.object().keys(createCertificatesRequest),
}


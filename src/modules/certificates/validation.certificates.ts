import Joi from 'joi'
import { CertificatesInterface, CertificatesStatus } from './interface.certificates'

const createCertificatesRequest: Record<keyof Pick<CertificatesInterface, "name" | "status" | "signatories">, any> = {
  name: Joi.string().required(),
  status: Joi.string().valid(...Object.values(CertificatesStatus)),
  signatories: Joi.array().items(Joi.string()).required().max(2).min(1)
}

export const updateCertificates = {
  body: Joi.object<Partial<Pick<CertificatesInterface, "name" | "components">>>().keys({
    name: Joi.string().required(),
    components: Joi.object().keys({
      bg: Joi.string().required(),
      name: Joi.string().optional(),
      components: Joi.array().min(0)
    }).unknown(true)
  })
}

export const createCertificates = {
  body: Joi.object().keys(createCertificatesRequest),
}


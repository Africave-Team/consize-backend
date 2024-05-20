import Joi from 'joi'

export const generateSection = {
  body: Joi.object().keys({
    courseId: Joi.string().required(),
    lessonId: Joi.string().required(),
    seedTitle: Joi.string().required(),
  }),
}

export const rewriteSection = {
  body: Joi.object().keys({
    courseId: Joi.string().required(),
    lessonId: Joi.string().required(),
    seedTitle: Joi.string().required(),
    seedContent: Joi.string().required(),
  }),
}



export const SectionQuiz = {
  body: Joi.object().keys({
    isFollowup: Joi.boolean().required(),
    content: Joi.string().required(),
  }),
}


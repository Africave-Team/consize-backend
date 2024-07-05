import Joi from 'joi'
import { CourseStatus, CreateCoursePayload, Media, MediaType, Sources } from './interfaces.courses'
import { CreateLessonPayload } from './interfaces.lessons'
import { CreateBlockPayload } from './interfaces.blocks'
import { CreateQuizPayload } from './interfaces.quizzes'

const createCourseRequest: Record<keyof CreateCoursePayload, any> = {
  free: Joi.boolean(),
  bundle: Joi.boolean(),
  library: Joi.boolean(),
  private: Joi.boolean(),
  headerMedia: Joi.object<Media>().keys({
    awsFileKey: Joi.string().optional().allow(''),
    mediaType: Joi.string().valid(...Object.values(MediaType)),
    url: Joi.string().required()
  }),
  title: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().optional(),
  source: Joi.string().optional().valid(...Object.values(Sources)),
  status: Joi.string().optional().valid(...Object.values(CourseStatus)),
  currentCohort: Joi.string().optional(),
  survey: Joi.string().optional(),
  courses: Joi.when('bundle', {
    is: true,
    then: Joi.array().items(Joi.string()).required(),
    otherwise: Joi.array().items(Joi.string()).optional()
  })
}

const createCourseAIRequest: Record<keyof { jobId: string }, any> = {
  jobId: Joi.string().required(),
}

export const createCourse = {
  body: Joi.object().keys(createCourseRequest),
}

export const duplicateCourse = {
  body: Joi.object().keys({
    headerMediaUrl: Joi.string().required(),
    title: Joi.string().required(),
    description: Joi.string().required(),
  }),
}
export const createCourseAi = {
  body: Joi.object().keys(createCourseAIRequest),
}
export const generateCourseOutlineAI = {
  body: Joi.object().keys({
    jobId: Joi.string().optional(),
    title: Joi.string().required(),
    lessonCount: Joi.number().required()
  }),
}

export const createCourseFile = {
  body: Joi.object().keys(createCourseAIRequest),
}
export const generateCourseOutlineFile = {
  body: Joi.object().keys({
    jobId: Joi.string().optional(),
    title: Joi.string().required(),
    files: Joi.array().items(Joi.string().required()).min(1)
  }),
}
export const updateCourse = {
  body: Joi.object<Partial<CreateCoursePayload>>().keys({
    free: Joi.boolean(),
    bundle: Joi.boolean(),
    private: Joi.boolean(),
    headerMedia: Joi.object<Media>().keys({
      awsFileKey: Joi.string().optional().allow(''),
      mediaType: Joi.string().valid(...Object.values(MediaType)),
      url: Joi.string().required()
    }).unknown(true),
    title: Joi.string(),
    description: Joi.string(),
    price: Joi.number().optional(),
    courses: Joi.when('bundle', {
      is: true,
      then: Joi.array().items(Joi.string()).min(2).required(),
      otherwise: Joi.array().items(Joi.string()).optional()
    })
  }).unknown(true),
  params: Joi.object().keys({
    course: Joi.string().required()
  })
}

export const createLesson = {
  body: Joi.object<CreateLessonPayload>().keys({
    title: Joi.string().required(),
    description: Joi.string().optional().allow("")
  }),
  params: Joi.object().keys({
    course: Joi.string().required()
  })
}

export const updateLesson = {
  body: Joi.object<CreateLessonPayload>().keys({
    title: Joi.string().required(),
    description: Joi.string().optional().allow("")
  }),
  params: Joi.object().keys({
    course: Joi.string().required(),
    lesson: Joi.string().required(),
  })
}




// create and update blocks

export const createBlock = {
  body: Joi.object<CreateBlockPayload>().keys({
    title: Joi.string().required(),
    content: Joi.string().required(),
    bodyMedia: Joi.object<Media>().keys({
      awsFileKey: Joi.string().optional(),
      mediaType: Joi.string().valid(...Object.values(MediaType)),
      url: Joi.string().optional().allow(""),
      embedUrl: Joi.string().optional().allow("")
    }).optional(),
    quiz: Joi.string().optional()
  }),
  params: Joi.object().keys({
    course: Joi.string().required(),
    lesson: Joi.string().required(),
  })
}

export const updateBlock = {
  body: Joi.object<CreateBlockPayload>().keys({
    title: Joi.string().required(),
    content: Joi.string().required(),
    bodyMedia: Joi.object<Media>().keys({
      awsFileKey: Joi.string().required(),
      mediaType: Joi.string().valid(...Object.values(MediaType)),
      url: Joi.string().required(),
      embedUrl: Joi.string().optional().allow("")
    }).optional(),
    quiz: Joi.string().optional()
  }),
  params: Joi.object().keys({
    course: Joi.string().required(),
    lesson: Joi.string().required(),
    block: Joi.string().required(),
  })
}


//quiz
export const createQuiz: Record<keyof CreateQuizPayload, any> = {
  question: Joi.string().required(),
  correctAnswerContext: Joi.string().required(),
  wrongAnswerContext: Joi.string().required(),
  choices: Joi.array().items(Joi.string()).required(),
  correctAnswerIndex: Joi.number().required(),
  revisitChunk: Joi.string().required(),
  hint: Joi.string().optional(),
  block: Joi.string().optional(),
}
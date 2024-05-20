import { Request, Response } from 'express'
import { catchAsync } from '../utils'
import * as aiService from "./services"


export const generateLessonSection = catchAsync(async (req: Request, res: Response) => {
  const { courseId, lessonId, seedTitle } = req.body
  const data = await aiService.buildLessonSection({ courseId, lessonId, seedTitle })
  res.status(200).send({ message: "Here is your content", data })
})

export const rewriteLessonSection = catchAsync(async (req: Request, res: Response) => {
  const { courseId, lessonId, seedTitle, seedContent } = req.body
  const data = await aiService.rewriteLessonSection({ courseId, lessonId, seedTitle, seedContent })
  res.status(200).send({ message: "Here is your content", data })
})


export const generateLessonSectionQuiz = catchAsync(async (req: Request, res: Response) => {
  const { content, isFollowup } = req.body
  const data = await aiService.buildLessonSectionQuiz({ content, followup: isFollowup })
  res.status(200).send({ message: "Here is your content", data })
})

export const rewriteLessonSectionQuiz = catchAsync(async (req: Request, res: Response) => {
  const { content, isFollowup } = req.body
  const data = await aiService.rewriteLessonSectionQuiz({ content, followup: isFollowup })
  res.status(200).send({ message: "Here is your content", data })
})
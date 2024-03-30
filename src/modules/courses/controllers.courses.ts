import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import * as courseService from './service.courses'
import httpStatus from 'http-status'
import { redisClient } from '../redis'
import { CourseInterface } from './interfaces.courses'
import { QueryResult } from '../paginate/paginate'
// import { agenda } from '../scheduler'


export const createCourseManually = catchAsync(async (req: Request, res: Response) => {
  const createdCourse = await courseService.createCourse(req.body, req.user.team)
  res.status(httpStatus.CREATED).send({ data: createdCourse, message: "Your course has been created successfully" })
})
export const updateCourse = catchAsync(async (req: Request, res: Response) => {
  if (req.params['course']) {
    const createdCourse = await courseService.updateCourse(req.body, req.params['course'], req.user.team)
    res.status(httpStatus.OK).send({ course: createdCourse, message: "Your course has been updated successfully" })
  }
})

export const fetchTeamCourses = catchAsync(async (req: Request, res: Response) => {
  const { page, pageSize, search } = req.query
  const parsedPage = parseInt(page as string, 10) || 1
  const parsedPageSize = parseInt(pageSize as string, 10) || 20
  const searchKey = search as string

  const query: any = { teamId: req.user.team, page: parsedPage, pageSize: parsedPageSize }
  if (search) {
    query['search'] = searchKey
  }
  let results: QueryResult<CourseInterface>
  const queryString = JSON.stringify(query)
  if (redisClient.isReady) {
    const redisDataExists = await redisClient.get(queryString)
    if (redisDataExists) {
      results = JSON.parse(redisDataExists) as QueryResult<CourseInterface>
    } else {
      results = await courseService.fetchTeamCourses(query)
      if (redisClient.isReady) {
        await redisClient.set(queryString, JSON.stringify(results), { EX: 100 })
      }
    }
  } else {
    results = await courseService.fetchTeamCourses(query)
    if (redisClient.isReady) {
      await redisClient.set(queryString, JSON.stringify(results), { EX: 100 })
    }
  }


  res.status(httpStatus.OK).send({ ...results, message: "Here they are." })
})


export const fetchTeamSingleCourse = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params

  const query: any = { teamId: req.user.team, courseId: course }
  let results: CourseInterface | null
  const queryString = JSON.stringify(query)
  if (redisClient.isReady) {
    const redisDataExists = await redisClient.get(queryString)
    if (redisDataExists) {
      results = JSON.parse(redisDataExists) as CourseInterface
    } else {
      results = await courseService.fetchSingleTeamCourse(query)
      if (redisClient.isReady) {
        await redisClient.set(queryString, JSON.stringify(results), { EX: 100 })
      }
    }
  } else {
    results = await courseService.fetchSingleTeamCourse(query)
    if (redisClient.isReady) {
      await redisClient.set(queryString, JSON.stringify(results), { EX: 100 })
    }
  }


  res.status(httpStatus.OK).send({ data: results, message: "Here you are." })
})

// lessons
export const addLessonToCourse = catchAsync(async (req: Request, res: Response) => {
  if (req.params['course']) {
    const createdCourse = await courseService.createCourse(req.body, req.user.team)
    res.status(httpStatus.CREATED).send({ data: createdCourse, message: "Your lesson has been added successfully" })
  }
})

export const fetchCourseLessons = catchAsync(async (req: Request, res: Response) => {
  if (req.params['course']) {
    const lessons = await courseService.fetchCourseLessons({ course: req.params['course'] })
    res.status(httpStatus.CREATED).send({ data: lessons, message: "Here are your lessons" })
  }
})

export const fetchSingleCourseLesson = catchAsync(async (req: Request, res: Response) => {
  if (req.params['lesson']) {
    const lessons = await courseService.fetchSingleLesson({ lesson: req.params['lesson'] })
    res.status(httpStatus.CREATED).send({ data: lessons, message: "Here you are" })
  }
})

export const deleteCourselesson = catchAsync(async (req: Request, res: Response) => {
  if (req.params['lesson']) {
    await courseService.deleteLesson(req.params['lesson'])
    res.status(httpStatus.NO_CONTENT)
  }
})

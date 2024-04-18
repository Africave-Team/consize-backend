import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import * as courseService from './service.courses'
import httpStatus from 'http-status'
// import { redisClient } from '../redis'
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
  const { page, pageSize, filter } = req.query
  const parsedPage = parseInt(page as string, 10) || 1
  const parsedPageSize = parseInt(pageSize as string, 10) || 20
  const filterkey = filter as string

  const query: any = { teamId: req.user.team, page: parsedPage, pageSize: parsedPageSize, filter: filterkey }
  let results: QueryResult<CourseInterface>
  // const queryString = JSON.stringify(query)
  // if (redisClient.isReady) {
  //   const redisDataExists = await redisClient.get(queryString)
  //   if (redisDataExists) {
  //     results = JSON.parse(redisDataExists) as QueryResult<CourseInterface>
  //   } else {
  //     results = await courseService.fetchTeamCourses(query)
  //     if (redisClient.isReady) {
  //       await redisClient.set(queryString, JSON.stringify(results), { EX: 100 })
  //     }
  //   }
  // } else {
  //   results = await courseService.fetchTeamCourses(query)
  //   if (redisClient.isReady) {
  //     await redisClient.set(queryString, JSON.stringify(results), { EX: 100 })
  //   }
  // }

  results = await courseService.fetchTeamCourses(query)


  res.status(httpStatus.OK).send({ ...results, message: "Here they are." })
})

export const fetchPublishedCourses = catchAsync(async (req: Request, res: Response) => {
  const { page, pageSize } = req.query
  const parsedPage = parseInt(page as string, 10) || 1
  const parsedPageSize = parseInt(pageSize as string, 10) || 20

  const query: any = { page: parsedPage, pageSize: parsedPageSize }
  let results: QueryResult<CourseInterface>

  results = await courseService.fetchPublishedCourses(query)


  res.status(httpStatus.OK).send({ ...results, message: "Here they are." })
})



export const fetchSingleCourse = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params

  const query: any = { courseId: course }
  let results: CourseInterface | null

  results = await courseService.fetchSingleCourse(query)

  if (!results) return res.status(httpStatus.NOT_FOUND).send({ message: "Course not found" })

  return res.status(httpStatus.OK).send({
    data: results, message: "Here you are."
  })
})


export const searchTeamCourses = catchAsync(async (req: Request, res: Response) => {
  const { page, search } = req.query
  const parsedPage = parseInt(page as string, 10) || 1

  const searchKey = search as string
  const query: any = { teamId: req.user.team, page: parsedPage }

  if (search) {
    query['search'] = searchKey
  }
  let results: CourseInterface[]
  results = await courseService.searchTeamCourses(query)


  res.status(httpStatus.OK).send({ data: results, message: "Here they are." })
})


export const fetchTeamSingleCourse = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params

  const query: any = { teamId: req.user.team, courseId: course }
  let results: CourseInterface | null
  // const queryString = JSON.stringify(query)
  // if (redisClient.isReady) {
  //   const redisDataExists = await redisClient.get(queryString)
  //   if (redisDataExists) {
  //     results = JSON.parse(redisDataExists) as CourseInterface
  //   } else {
  //     results = await courseService.fetchSingleTeamCourse(query)
  //     if (redisClient.isReady) {
  //       await redisClient.set(queryString, JSON.stringify(results), { EX: 100 })
  //     }
  //   }
  // } else {
  //   results = await courseService.fetchSingleTeamCourse(query)
  //   if (redisClient.isReady) {
  //     await redisClient.set(queryString, JSON.stringify(results), { EX: 100 })
  //   }
  // }

  results = await courseService.fetchSingleTeamCourse(query)

  if (!results) return res.status(httpStatus.NOT_FOUND).send({ message: "Course not found" })
  const settings = await courseService.fetchSingleSettings(results.settings)
  const groups: any[] = []
  if (settings) {
    for (let group of settings.learnerGroups) {
      const mems = await courseService.fetchLearnerGroupMembers(group.members)
      groups.push({
        id: group._id,
        launchTimes: group.launchTimes,
        name: group.name,
        members: mems
      })
    }
  }

  return res.status(httpStatus.OK).send({
    data: {
      ...results,
      id: results._id,  //@ts-ignore
      lessons: results.lessons.map((e) => ({ ...e, id: e._id })),
      settings: {
        ...settings, //@ts-ignore
        id: settings?._id,
        learnerGroups: groups
      }
    }, message: "Here you are."
  })
})

// lessons
export const addLessonToCourse = catchAsync(async (req: Request, res: Response) => {
  if (req.params['course']) {
    const createdLesson = await courseService.createLesson(req.body, req.params["course"])
    res.status(httpStatus.CREATED).send({ data: createdLesson, message: "Your lesson has been added successfully" })
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

export const deleteCourseLesson = catchAsync(async (req: Request, res: Response) => {
  if (req.params['lesson'] && req.params['course']) {
    await courseService.deleteLesson(req.params['lesson'], req.params['course'])
    res.status(httpStatus.NO_CONTENT).send()
  }
})

export const updateCourseLesson = catchAsync(async (req: Request, res: Response) => {
  const { lesson } = req.params
  if (lesson) {
    const updatedLesson = await courseService.updateLesson(req.body, lesson)
    res.status(httpStatus.OK).send({ data: updatedLesson, message: "Your lesson has been updated successfully" })
  }
})

export const addBlockToLesson = catchAsync(async (req: Request, res: Response) => {
  const { lesson, course } = req.params

  if (lesson && course) {
    const createdBlock = await courseService.createBlock(req.body, lesson, course)
    res.status(httpStatus.OK).send({ data: createdBlock, message: "Your block has been created successfully" })
  }
})

export const deleteBlockFromLesson = catchAsync(async (req: Request, res: Response) => {
  const { block, lesson } = req.params
  if (block && lesson) {
    await courseService.deleteBlockFromLesson(block, lesson)
  }
  res.status(httpStatus.NO_CONTENT).send()
})

export const updateBlock = catchAsync(async (req: Request, res: Response) => {
  const { block } = req.params
  if (block) {
    const updatedBlock = courseService.updateBlock(req.body, block)
    res.status(httpStatus.OK).send({ data: updatedBlock, message: "Block Updated successfully" })
  }
})

export const fetchLessonsBlocks = catchAsync(async (req: Request, res: Response) => {
  const { course, lesson } = req.params
  if (lesson && course) {
    const blocks = await courseService.fetchLessonsBlocks({ course: course, lesson: lesson })
    res.status(httpStatus.OK).send({ data: blocks, message: "block retrieved successfully" })
  }
})

export const fetchLessonsQuiz = catchAsync(async (req: Request, res: Response) => {
  const { lesson } = req.params
  if (lesson) {
    const quizzes = await courseService.fetchLessonsQuiz(lesson)
    res.status(httpStatus.OK).send({ data: quizzes, message: "quizzes retrieved successfully" })
  }
})

export const addQuizToBlock = catchAsync(async (req: Request, res: Response) => {
  const { block, lesson, course } = req.params

  if (block && lesson && course) {
    const quiz = await courseService.addBlockQuiz(req.body, lesson, course, block)
    res.status(httpStatus.CREATED).send({ data: quiz, message: "Your quiz has been created successfully" })
  }
})

export const deleteQuizFromBlock = catchAsync(async (req: Request, res: Response) => {
  const { block, quiz } = req.params
  if (block && quiz) {
    await courseService.deleteQuizFromBlock(block, quiz)
  }
  res.status(httpStatus.NO_CONTENT).send()
})

export const addQuizToLesson = catchAsync(async (req: Request, res: Response) => {
  const { lesson, course } = req.params

  if (lesson && course) {
    const quiz = await courseService.addLessonQuiz(req.body, lesson, course)
    res.status(httpStatus.CREATED).send({ data: quiz, message: "Your quiz has been created successfully" })
  }
})

export const updateQuiz = catchAsync(async (req: Request, res: Response) => {
  const { quiz } = req.params

  if (quiz) {
    await courseService.updateQuiz(quiz, req.body)
    res.status(httpStatus.OK).send({ message: "Your quiz has been updated successfully" })
  }
})

export const deleteQuizFromLesson = catchAsync(async (req: Request, res: Response) => {
  const { lesson, quiz } = req.params
  if (lesson && quiz) {
    await courseService.deleteQuizFromLesson(lesson, quiz)
  }
  res.status(httpStatus.NO_CONTENT).send()
})


// settings
export const updateCourseSetting = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  if (id) {
    await courseService.updateCourseSettings(id, req.body)
  }
  res.status(200).send({ message: "Settings updated" })
})

export const addLearnerGroup = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params
  if (id) {
    const { id: groupId, name, members, launchTimes } = req.body
    await courseService.addLearnerGroup(id, { id: groupId, name, members, launchTimes })
  }
  res.status(200).send({ message: "Settings updated" })
})


export const removeLearnerGroup = catchAsync(async (req: Request, res: Response) => {
  const { id, groupId } = req.params
  if (id && groupId) {
    await courseService.removeLearnerGroup(id, groupId)
  }
  res.status(200).send({ message: "Settings updated" })
})

export const setLearnerGroupLaunchTime = catchAsync(async (req: Request, res: Response) => {
  const { id, groupId } = req.params
  if (id && groupId) {
    await courseService.setLearnerGroupLaunchTime(groupId, id, req.body)
  }
  res.status(200).send({ message: "Settings updated" })
})


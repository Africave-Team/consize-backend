import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import * as courseService from './service.courses'
import httpStatus from 'http-status'
// import { redisClient } from '../redis'
import { CourseInterface } from './interfaces.courses'
import { QueryResult } from '../paginate/paginate'
import { unlinkSync } from 'fs'
import { QuizInterface } from './interfaces.quizzes'
import Assessment from '../statistics/assessment.model'
import QuestionGroup from './model.question-group'
import { transitionMessages as defaultTransitionMessage } from './interfaces.transition-messages'
import TransitionMessage from './model.transition-message'
import { teamService } from '../teams'
import { generateCourseFlow } from '../webhooks/service.webhooks'
// import { agenda } from '../scheduler'
// import { unlinkSync } from "fs"

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
  const { page, pageSize, library, search, team } = req.query
  const isLibrary = parseInt(library as string, 10) || 0
  const parsedPage = parseInt(page as string, 10) || 1
  const parsedPageSize = parseInt(pageSize as string, 10) || 20
  const searchKey = search as string
  const teamId = team as string


  const query: any = { page: parsedPage, pageSize: parsedPageSize, library: isLibrary === 1 }
  if (search) {
    query['search'] = searchKey
  }
  if (team) {
    query['owner'] = teamId
  }
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
  const { page, search, filter } = req.query
  const parsedPage = parseInt(page as string, 10) || 1

  const searchKey = search as string
  const query: any = { teamId: req.user.team, page: parsedPage, filter }

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

  const team = await teamService.fetchTeamById(req.user.team)

  return res.status(httpStatus.OK).send({
    data: {
      ...results,
      id: results._id,  //@ts-ignore
      lessons: results.lessons.map((e) => ({ ...e, id: e._id })),
      settings: {
        ...settings, //@ts-ignore
        id: settings?._id,
        learnerGroups: groups
      },
      team
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

export const createQuiz = catchAsync(async (req: Request, res: Response) => {
  // const { course } = req.params

  // if (course) {
  //   const quiz = await courseService.addQuiz(req.body, course)
  //   res.status(httpStatus.CREATED).send({ data: quiz, message: "Your question has been created successfully" })
  // }

  const { lesson, course } = req.params

  if (lesson && course) {
    const quiz = await courseService.addLessonQuiz(req.body, lesson, course)
    res.status(httpStatus.CREATED).send({ data: quiz, message: "Your quiz has been created successfully" })
  }
})


export const createAssessmentQuiz = catchAsync(async (req: Request, res: Response) => {
  const { assessmentId, course } = req.params

  if (assessmentId && course) {
    const quiz = await courseService.addAssessmentQuiz(req.body, assessmentId, course)
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

export const addQuizToLesson = catchAsync(async (req: Request, res: Response) => {
  const { lesson, course } = req.params

  if (lesson && course) {
    const quiz = await courseService.addLessonQuiz(req.body, lesson, course)
    res.status(httpStatus.CREATED).send({ data: quiz, message: "Your quiz has been created successfully" })
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


export const exportStats = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  if (course) {
    const { file, filename } = await courseService.exportCourseStats(course)
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
    return res.download(file, filename, (err) => {
      unlinkSync(file)
      console.log(err)
    })
  } else {
    return res.status(200).send({ message: "Settings updated" })
  }
})

// AI apis
export const createCourseAI = catchAsync(async (req: Request, res: Response) => {
  const createdCourse = await courseService.createAICourse({ ...req.body, teamId: req.user.team })
  res.status(httpStatus.OK).send({ data: createdCourse, message: "Your course has been created successfully" })
})


export const generateCourseOutline = catchAsync(async (req: Request, res: Response) => {
  const { lessonCount, title, jobId } = req.body
  const data = await courseService.generateCourseOutlineAI({ title, lessonCount, jobId })
  res.status(200).send({ message: "Job has been queued", data })
})



export const createCourseFile = catchAsync(async (req: Request, res: Response) => {
  const createdCourse = await courseService.generateCourseOutlineFile({ ...req.body, teamId: req.user.team })
  res.status(httpStatus.OK).send({ data: createdCourse, message: "Your course has been created successfully" })
})


export const generateCourseOutlineFile = catchAsync(async (req: Request, res: Response) => {
  const data = await courseService.generateCourseOutlineFile({ ...req.body, teamId: req.user.team })
  res.status(200).send({ message: "Job has been queued", data })
})


export const deleteCourse = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  if (course) {
    await courseService.deleteCourse({ courseId: course })
  }
  res.status(200).send({ message: "Course deleted" })
})


export const duplicateCourse = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  const { title, headerMediaUrl, description } = req.body
  let data
  if (course) {
    data = await courseService.duplicateCourse({ courseId: course, title, headerMediaUrl, description }, req.user.team)
  }
  res.status(200).send({ message: "Course duplicated", data })
})


export const generateCourseHeader = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  let data
  if (course) {
    data = await courseService.generateCourseHeader({ courseId: course })
  }
  res.status(200).send({ message: "Course duplicated", data })
})

export const fetchQuestion = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  const { questionType } = req.query
  let questions
  if (course) {
    questions = await courseService.fetchCourseQuestions({ course, questionType })
  }
  res.status(200).send({ message: "questions retrieved", questions })
})

export const createQuestionsGroup = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  let questionGroup
  if (course) {
    questionGroup = await courseService.addQuestionGroup(req.body, course)
  }
  res.status(200).send({ message: "questions group created", questionGroup })
})

export const singleQuestionsGroup = catchAsync(async (req: Request, res: Response) => {
  const { assessmentId } = req.params
  let questionGroup
  if (assessmentId) {
    questionGroup = await courseService.fetchSingleQuestionGroup({ assessmentId })
  }
  res.status(200).send({ message: "question group found", data: questionGroup })
})

export const deleteQuestionsGroup = catchAsync(async (req: Request, res: Response) => {
  const { assessmentId } = req.params
  if (assessmentId) {
    await courseService.deleteQuestionGroup({ assessmentId })
  }
  res.status(200).send({ message: "question group deleted" })
})


export const updateQuestionsGroup = catchAsync(async (req: Request, res: Response) => {
  const { assessmentId } = req.params
  let questionGroup
  if (assessmentId) {
    questionGroup = await courseService.updateQuestionGroup({ assessmentId, ...req.body })
  }
  res.status(200).send({ message: "question group updated", data: questionGroup })
})


export const fetchQuizQuestionsByCourseId = catchAsync(async (req: Request, res: Response) => {
  const { course, assessment } = req.params
  let questions: QuizInterface[] = []
  if (course && assessment) {
    questions = await courseService.fetchQuestionsByCourseId({ course, assessment })
  }
  res.status(200).send({ message: "questions retrieved", data: questions })
})


export const generateCourseRedisData = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  if (course) {
    await generateCourseFlow(course)
  }
  res.status(200).send({ message: "generated" })
})

export const fetchQuestionGroups = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  const { type } = req.query
  let questionsGroups
  if (course) {
    questionsGroups = await courseService.fetchCourseQuestionGroups({ course, type })
  }
  res.status(200).send({ message: "questions group retrieved", data: questionsGroups })
})

export const fetchAssessmentScore = catchAsync(async (req: Request, res: Response) => {
  const { assessment } = req.params
  let assessments
  if (assessment) {
    assessments = await Assessment.aggregate([
      {
        $match: { assessmentId: assessment }  // Match the given assessment ID
      },
      {
        $lookup: {
          from: 'students',  // Join with students collection
          localField: 'studentId',  // Field from assessments collection
          foreignField: '_id',  // Field from students collection
          as: 'studentDetails'  // Output field
        }
      },
      {
        $unwind: '$studentDetails'  // Unwind the studentDetails array
      },
      {
        $project: {
          _id: 1,
          studentId: 1,
          courseId: 1,
          teamId: 1,
          assessmentId: 1,
          score: 1,
          'studentDetails.firstName': 1,
          'studentDetails.otherNames': 1  // Only include required student fields
        }
      }
    ])
  }
  res.status(200).send({ message: "assessment retrieved", assessments: assessments })
})

export const fetchAssessment = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  let assessment
  if (course) {
    assessment = await QuestionGroup.aggregate([
      {
        // Match the question groups by courseId
        $match: { course: course }
      },
      {
        // Lookup the assessments for each question group
        $lookup: {
          from: 'assessments',
          localField: '_id',
          foreignField: 'assessmentId',
          as: 'assessments'
        }
      },
      {
        // Calculate the average score and total number of submissions per assessment
        $addFields: {
          averageScore: { $avg: '$assessments.score' },
          totalSubmissions: { $size: '$assessments' }
        }
      },
      {
        // Project the desired fields: question group name, average score, total submissions
        $project: {
          _id: 1,
          title: 1,
          averageScore: 1,
          totalSubmissions: 1
        }
      }
    ])

  }
  res.status(200).send({ message: "assessment retrieved", assessment: assessment })
})

export const fetchStudentAssessmentScoreByCourse = catchAsync(async (req: Request, res: Response) => {
  const { course, student } = req.params
  let assessments: any = []
  if (course && student) {
    assessments = await Assessment.find({
      studentId: student,  // Match the given student ID
      courseId: course     // Match the given course ID
    })

  }
  res.status(200).send({ message: "assessment retrieved", assessments: assessments })
})

export const fetchTransitionMessage = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  let customTransitionMessages: any = []

  if (course) {
    customTransitionMessages = await TransitionMessage.find({ course })
  }

  res.status(200).send({
    defaultTransitionMessages: defaultTransitionMessage,
    customTransitionMessages: customTransitionMessages
  })
})

export const createTransitionMessage = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params

  const { message, type } = req.body

  const updatedDocument = await TransitionMessage.findOneAndUpdate(
    { course, type }, // Match criteria
    { message, course, type }, // Fields to update or set on insert
    {
      new: true, // Return the updated document
      upsert: true, // Create a new document if no match is found
      setDefaultsOnInsert: true, // Apply default values on new document creation
    }
  )

  // Respond with the updated or created document
  res.status(200).json(updatedDocument)
})


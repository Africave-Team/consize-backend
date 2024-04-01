import { ApiError } from '../errors'
import httpStatus from 'http-status'
// import { QueryResult } from '../paginate/paginate'
import { QueryResult } from '../paginate/paginate'
import db from "../rtdb"
import { CourseStatistics } from '../rtdb/interfaces.rtdb'
import { COURSE_STATS } from '../rtdb/nodes'
import { CourseInterface,CourseStatus, CreateCoursePayload } from './interfaces.courses'
import Course from './model.courses'
import { CreateLessonPayload, LessonInterface } from './interfaces.lessons'
import Lessons from './model.lessons'
import { BlockInterface, CreateBlockPayload } from './interfaces.blocks'
import Blocks from './model.blocks'
import { CreateQuizPyaload, QuizInterface } from './interfaces.quizzes'
import Quizzes from './model.quizzes'
import Settings from './model.settings'
import { DropoutEvents, PeriodTypes } from './interfaces.settings'

enum PageType {
  ALL = 'all',
  COURSE = 'course',
  BUNDLE = 'bundle',
  DRAFT = 'draft'
}


export const createCourse = async (coursePayload: CreateCoursePayload, teamId: string): Promise<CourseInterface> => {
  const course = new Course({ ...coursePayload, owner: teamId })
  await course.save()
  setInitialCourseStats(course.id)
  setInitialCourseSettings(course.id)
  return course
}

const setInitialCourseStats = async (id: string) => {

  const dbRef = db.ref(COURSE_STATS)
  const initialStats: CourseStatistics = {
    enrolled: 0,
    active: 0,
    averageCompletionPercentage: 0,
    dropouts: 0,
    completed: 0,
    averageTestScore: 0,
    averageCompletionDays: 0,
    averageCompletionMinutes: 0,
    averageCourseDurationSeconds: 0,
    dropoutRate: 0,
    averageCourseProgress: 0,
    averageMcqRetakeRate: 0,
    averageLessonDurationMinutes: 0,
    averageBlockDurationMinutes: 0,
    averageBlockDurationSeconds: 0
  }
  await dbRef.child(id).set(initialStats)
}

const setInitialCourseSettings = async function (id: string) {
  const setting = new Settings({
    enrollmentFormFields: [
      {
        fieldName: "First name",
        variableName: "firstName",
        required: true,
        defaultField: true,
        position: 0
      },
      {
        fieldName: "Other names",
        variableName: "otherNames",
        required: true,
        defaultField: true,
        position: 1
      },
      {
        fieldName: "Email address",
        variableName: "email",
        required: true,
        defaultField: true,
        position: 1
      },
      {
        fieldName: "Phone number",
        variableName: "phoneNumber",
        required: true,
        defaultField: true,
        position: 1
      }
    ],
    metadata: {
      courseCompletionDays: 5,
      idealLessonTime: {
        type: PeriodTypes.MINUTES,
        value: 30
      },
      maxEnrollments: 100,
      maxLessonsPerDay: 4,
      minLessonsPerDay: 1
    },
    learnerGroups: [],
    courseMaterials: [],
    reminderSchedule: ["08:00 AM", "01:00 PM"],
    dropoutWaitPeriod: {
      value: 2,
      type: PeriodTypes.DAYS
    },
    reminderDuration: {
      value: 1,
      type: PeriodTypes.HOURS
    },
    inactivityPeriod: {
      value: 1,
      type: PeriodTypes.DAYS
    },
    dropoutEvent: DropoutEvents.LESSON_COMPLETION
  })
  await Course.findByIdAndUpdate(id, { $set: { settings: setting.id } })
  await setting.save()
}

export const updateCourse = async (coursePayload: Partial<CreateCoursePayload>, courseId: string, teamId: string): Promise<CourseInterface> => {
  const course = await Course.findOneAndUpdate({ _id: courseId, owner: teamId }, { $set: { ...coursePayload } }, { new: true })
  if (!course) throw new ApiError(httpStatus.NOT_FOUND, 'Could not update the specified course')
  return course
}

export const fetchTeamCourses = async ({ teamId, page, pageSize, filter }: { teamId: string, page: number, pageSize: number, filter?: PageType }): Promise<QueryResult<CourseInterface>> => {
  const q: any = { owner: teamId }
  console.log(filter, teamId)
  if (filter) {
    switch (filter) {
      case PageType.ALL:
        q['$or'] = [{ status: CourseStatus.COMPLETED }, { status: CourseStatus.PUBLISHED }]
        break
      case PageType.BUNDLE:
        q['bundle'] = true
        q['$or'] = [{ status: CourseStatus.COMPLETED }, { status: CourseStatus.PUBLISHED }]
        break
      case PageType.COURSE:
        q['bundle'] = false
        q['$or'] = [{ status: CourseStatus.COMPLETED }, { status: CourseStatus.PUBLISHED }]
        break
      case PageType.DRAFT:
        q['status'] = CourseStatus.DRAFT
        break
      default:
        break
    }
  }
  return Course.paginate(q, { page, limit: pageSize, populate: 'lessons,courses' })

}

export const searchTeamCourses = async ({ teamId, search }: { teamId: string, search: string }): Promise<CourseInterface[]> => {
  const regex = new RegExp(search, "i")
  return Course.find({ owner: teamId, $or: [{ title: { $regex: regex } }, { description: { $regex: regex } }] }).limit(16)

}

export const fetchSingleTeamCourse = async ({ teamId, courseId }: { teamId: string, courseId: string }): Promise<CourseInterface | null> => {
  return Course.findOne({ owner: teamId, _id: courseId }).populate("lessons").populate("courses")
}

// lessons

export const createLesson = async (lessonPayload: CreateLessonPayload, course: string): Promise<LessonInterface> => {
  const lesson = new Lessons({ ...lessonPayload, course })
  await Course.findByIdAndUpdate(course, { $push: { lessons: lesson.id } })
  await lesson.save()
  return lesson
}


export const updateLesson = async (lessonPayload: Partial<CreateLessonPayload>, lesson: string): Promise<LessonInterface> => {
  const updatedLesson = await Lessons.findByIdAndUpdate(lesson, { $set: lessonPayload }, { new: true })
  if (!updatedLesson) throw new ApiError(httpStatus.NOT_FOUND, "Could not find this lesson to update")
  return updatedLesson
}


export const fetchCourseLessons = async ({ course }: { course: string }): Promise<LessonInterface[]> => {
  const results = await Lessons.find({ course }).populate("blocks").populate("course")
  return results
}

export const fetchSingleLesson = async ({ lesson }: { lesson: string }): Promise<LessonInterface | null> => {
  return Lessons.findById(lesson).populate("blocks").populate("course")
}

export const deleteLesson = async function (lesson: string) {
  await Lessons.findByIdAndDelete(lesson)
}

export const fetchLessonsQuiz = async (lesson:string): Promise<QuizInterface[]> => {
  return await Quizzes.find({lesson: lesson})
}
// blocks


export const createBlock = async (blockPayload: CreateBlockPayload, lesson: string, course: string): Promise<BlockInterface> => {
  const block = new Blocks({ ...blockPayload, lesson, course })
  await Lessons.findByIdAndUpdate(lesson, { $push: { blocks: block.id } })
  await block.save()
  return block
}

export const updateBlock = async (blockPayload: Partial<CreateBlockPayload>, block: string): Promise<BlockInterface> => {
  const updatedBlock = await Blocks.findByIdAndUpdate(block, { $set: blockPayload }, { new: true })
  if (!updatedBlock) throw new ApiError(httpStatus.NOT_FOUND, "Could not find this block to update")
  return updatedBlock
}


export const fetchLessonsBlocks = async ({ course, lesson }: { course: string, lesson: string }): Promise<BlockInterface[]> => {
  const results = await Blocks.find({ course, lesson }).populate("quiz").populate("lesson").populate("course")
  return results
}

export const deleteBlockFromLesson = async function (block: string, lesson: string) {
  await Lessons.findByIdAndUpdate(lesson, { $pull: { blocks: block } })
  await Blocks.findByIdAndDelete(block)
}

export const fetchSingleLessonBlock = async ({ block }: { block: string }): Promise<LessonInterface | null> => {
  return Blocks.findById(block).populate("quiz").populate("lesson").populate("course")
}

// Quizzes
export const addLessonQuiz = async (quizPayload: CreateQuizPyaload, lesson: string, course: string): Promise<QuizInterface> => {
  const quiz = new Quizzes({ ...quizPayload, lesson, course })
  await Lessons.findByIdAndUpdate(lesson, { $push: { quizzes: quiz.id } })
  await quiz.save()
  return quiz
}

export const addBlockQuiz = async (quizPayload: CreateQuizPyaload, lesson: string, course: string, block: string): Promise<QuizInterface> => {
  const quiz = new Quizzes({ ...quizPayload, lesson, course, block })
  await Blocks.findByIdAndUpdate(block, { $set: { quiz: quiz.id } })
  await quiz.save()
  return quiz
}

export const deleteQuiz = async (quiz: string): Promise<void> => {
  await Quizzes.findByIdAndDelete(quiz)
}

export const deleteQuizFromBlock = async (quiz: string, block: string): Promise<void> => {
  await Blocks.findByIdAndUpdate(block, { $set: { quiz: undefined } })
}

export const deleteQuizFromLesson = async (quiz: string, lesson: string): Promise<void> => {
  await Lessons.findByIdAndUpdate(lesson, { $pull: { quiz: quiz } })
}
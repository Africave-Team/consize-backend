import { ApiError } from '../errors'
import httpStatus from 'http-status'
// import { QueryResult } from '../paginate/paginate'
import { QueryResult } from '../paginate/paginate'
import db from "../rtdb"
import { COURSE_STATS, COURSE_TRENDS } from '../rtdb/nodes'
import { CourseInterface, CourseStatus, CreateCoursePayload } from './interfaces.courses'
import Course from './model.courses'
import { CreateLessonPayload, LessonInterface } from './interfaces.lessons'
import Lessons from './model.lessons'
import { BlockInterface, CreateBlockPayload } from './interfaces.blocks'
import Blocks from './model.blocks'
import { CreateQuizPayload, QuizInterface } from './interfaces.quizzes'
import Quizzes from './model.quizzes'
import Settings from './model.settings'
import { CourseSettings, DropoutEvents, LearnerGroup, LearnerGroupLaunchTime, PeriodTypes } from './interfaces.settings'
import Students from '../students/model.students'
import { StudentCourseStats } from '../students/interface.students'
import moment from 'moment'
import { CourseStatistics } from '../rtdb/interfaces.rtdb'

interface SessionStudent extends StudentCourseStats {
  id: string
}

interface Trend {
  date: string
  value: number
}

interface TrendItem {
  trends: Trend[]
  current: number
}
interface TrendStatistics {
  enrolled: TrendItem
  active: TrendItem
  completed: TrendItem
  dropoutRate: TrendItem
  averageTestScore: TrendItem
  averageCompletionMinutes: TrendItem
  averageCourseProgress: TrendItem
  averageMcqRetakeRate: TrendItem
  averageLessonDurationMinutes: TrendItem
  averageBlockDurationMinutes: TrendItem
}
// import Students from '../students/model.students'

enum PageType {
  ALL = 'all',
  COURSE = 'course',
  BUNDLE = 'bundle',
  DRAFT = 'draft'
}


export const createCourse = async (coursePayload: CreateCoursePayload, teamId: string): Promise<CourseInterface> => {
  const course = new Course({ ...coursePayload, owner: teamId })
  await course.save()
  setInitialCourseStats(course.id, teamId)
  setInitialCourseSettings(course.id)
  return course
}

const setInitialCourseStats = async (id: string, teamId: string) => {

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
    averageBlockDurationSeconds: 0,

  }
  await dbRef.child(teamId).child(id).set(initialStats)
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


export const fetchPublishedCourses = async ({ page, pageSize }: { page: number, pageSize: number }): Promise<QueryResult<CourseInterface>> => {
  return Course.paginate({ status: CourseStatus.PUBLISHED }, { page, limit: pageSize, populate: 'lessons,courses' })

}

export const searchTeamCourses = async ({ teamId, search }: { teamId: string, search: string }): Promise<CourseInterface[]> => {
  const regex = new RegExp(search, "i")
  return Course.find({ owner: teamId, $or: [{ title: { $regex: regex } }, { description: { $regex: regex } }] }).limit(16)

}

export const fetchSingleTeamCourse = async ({ teamId, courseId }: { teamId: string, courseId: string }): Promise<CourseInterface | null> => {
  const course = await Course.findOne({ owner: teamId, _id: courseId }).populate({
    path: "lessons",
    populate: {
      path: "blocks",
      populate: {
        path: "quiz"
      }
    }
  }).populate({
    path: 'lessons',
    populate: {
      path: 'quizzes' // Populating quizzes at the lesson level
    }
  }).populate("courses").lean()
  return course
}


export const fetchSingleCourse = async ({ courseId }: { courseId: string }): Promise<CourseInterface | null> => {
  const course = await Course.findOne({ _id: courseId }).populate("lessons").populate("courses").populate('settings').populate('owner')
  return course
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
  return Lessons.findById(lesson).populate({
    path: "blocks",
    populate: {
      path: "quiz"
    }
  }).populate("course").populate("quizzes")
}

export const deleteLesson = async function (lesson: string, course: string) {
  await Course.findByIdAndUpdate(course, { $pull: { lessons: lesson } })
  await Lessons.findByIdAndDelete(lesson)
}

export const fetchLessonsQuiz = async (lesson: string): Promise<QuizInterface[]> => {
  return await Quizzes.find({ lesson: lesson })
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
  await Lessons.findByIdAndUpdate(lesson, { $pull: { blocks: block } }, { new: true })
  await Blocks.findByIdAndDelete(block)
}

export const fetchSingleLessonBlock = async ({ block }: { block: string }): Promise<LessonInterface | null> => {
  return Blocks.findById(block).populate("quiz").populate("lesson").populate("course")
}

// Quizzes
export const addLessonQuiz = async (quizPayload: CreateQuizPayload, lesson: string, course: string): Promise<QuizInterface> => {
  const quiz = new Quizzes({ ...quizPayload, lesson, course })
  await Lessons.findByIdAndUpdate(lesson, { $push: { quizzes: quiz.id } })
  await quiz.save()
  return quiz
}

export const addBlockQuiz = async (quizPayload: CreateQuizPayload, lesson: string, course: string, block: string): Promise<QuizInterface> => {
  const quiz = new Quizzes({ ...quizPayload, lesson, course, block })
  await Blocks.findByIdAndUpdate(block, { $set: { quiz: quiz.id } })
  await quiz.save()
  return quiz
}

export const deleteQuiz = async (quiz: string): Promise<void> => {
  await Quizzes.findByIdAndDelete(quiz)
}


export const updateQuiz = async (quiz: string, body: any): Promise<void> => {
  await Quizzes.findByIdAndUpdate(quiz, { $set: { ...body } })
}

export const deleteQuizFromBlock = async (block: string, quiz: string): Promise<void> => {
  await Blocks.findByIdAndUpdate(block, { $set: { quiz: null } }, { new: true })
  await Quizzes.findByIdAndDelete(quiz)
}

export const deleteQuizFromLesson = async (lesson: string, quiz: string): Promise<void> => {
  await Lessons.findByIdAndUpdate(lesson, { $pull: { quizzes: quiz } }, { new: true })
  await Quizzes.findByIdAndDelete(quiz)
}

// settings
export const updateCourseSettings = async (id: string, payload: Partial<CourseSettings>): Promise<void> => {

  await Settings.findByIdAndUpdate(id, { $set: payload })
}

export const fetchSingleSettings = async function (id: string): Promise<CourseSettings | null> {
  return Settings.findById(id).lean()
}

export const initiateGroupScheduleAgenda = async function (): Promise<void> {

}

export const addLearnerGroup = async (id: string, payload: Partial<LearnerGroup>): Promise<void> => {
  await Settings.findByIdAndUpdate(id, { $push: { learnerGroups: payload } })
  if (payload.launchTimes) {
    initiateGroupScheduleAgenda()
  }
}

export const setLearnerGroupLaunchTime = async (groupId: string, settingsId: string, launchTime: LearnerGroupLaunchTime): Promise<void> => {
  await Settings.findOneAndUpdate({ _id: settingsId, 'learnerGroups._id': groupId }, { $set: { 'learnerGroups.$.launchTimes': launchTime } })
  initiateGroupScheduleAgenda()
}

export const removeLearnerGroup = async (id: string, groupId: string): Promise<void> => {
  const settings = await Settings.findById(id)
  if (settings) {
    let groups = [...settings?.learnerGroups]
    let index = groups.findIndex(e => e.id === groupId)
    if (index >= 0) {
      let group = groups[index]
      await Settings.findByIdAndUpdate(id, { $pull: { learnerGroups: group } }).lean()
    }
  }
}


export const fetchLearnerGroupMembers = async (members: string[]) => {
  return Students.find({ _id: { $in: members } })
}

export const calculateCurrentStats = function (students: SessionStudent[]) {
  let copy = {
    enrolled: 0,
    active: 0,
    completed: 0,
    dropoutRate: 0,
    averageTestScore: 0,
    averageCompletionMinutes: 0,
    averageCourseProgress: 0,
    averageMcqRetakeRate: 0,
    averageLessonDurationMinutes: 0,
    averageBlockDurationMinutes: 0,
  }
  const scores = students.reduce((acc, curr) => {
    if (curr.scores && curr.scores.length > 0) {
      let total = curr.scores.reduce((a, b) => a + b, 0)
      return acc + total
    } else {
      return acc
    }
  }, 0)
  copy.enrolled = students.length
  copy.active = students.filter(e => !e.completed && !e.droppedOut).length
  copy.dropoutRate = (students.filter(e => e.droppedOut).length / copy.enrolled) * 100
  copy.completed = students.filter(e => e.completed).length
  copy.averageTestScore = (scores) / students.length

  copy.averageCourseProgress = students.reduce((acc, curr) => {
    if (curr.progress) {
      return acc + curr.progress
    } else {
      return acc
    }
  }, 0) / students.length

  copy.averageCompletionMinutes = students.reduce((acc, curr) => {
    if (curr.lessons) {
      const lessons = Object.values(curr.lessons)
      if (lessons.length === 0) {
        return acc
      } else {
        let total = lessons.reduce((a, b) => a + b.duration, 0)
        return acc + (total / 60)
      }
    } else {
      return acc
    }
  }, 0) / students.length

  let quizCount = 0
  let retakes = students.reduce((acc, curr) => {
    if (curr.lessons) {
      const lessons = Object.values(curr.lessons)
      if (lessons.length === 0) {
        return acc
      } else {
        let total = lessons.map(e => {
          if (e.quizzes) {
            const quizzes = Object.values(e.quizzes)
            quizCount += quizzes.length
            return quizzes.reduce((acc, curr) => acc + curr.retakes, 0) / quizzes.length
          }
          return 0
        }).reduce((a, b) => a + b, 0)
        return acc + (total)
      }
    } else {
      return acc
    }
  }, 0)

  copy.averageMcqRetakeRate = (retakes / quizCount) || 0

  let lessonCount = 0
  let lessonDuration = students.reduce((acc, curr) => {
    if (curr.lessons) {
      const lessons = Object.values(curr.lessons)
      if (lessons.length === 0) {
        return acc
      } else {
        lessonCount += lessons.length
        let total = lessons.map(e => {
          return e.duration / 60
        }).reduce((a, b) => a + b, 0)
        return acc + total
      }
    } else {
      return acc
    }
  }, 0)

  copy.averageLessonDurationMinutes = Math.round(lessonDuration / lessonCount) || 0

  let blockCount = 0
  let blockDuration = students.reduce((acc, curr) => {
    if (curr.lessons) {
      const lessons = Object.values(curr.lessons)
      if (lessons.length === 0) {
        return acc
      } else {
        let total = lessons.map(e => {
          if (e.blocks) {
            const blocks = Object.values(e.blocks)
            blockCount += blocks.length
            return blocks.reduce((acc, curr) => acc + curr.duration / 60, 0)
          }
          return 0
        }).reduce((a, b) => a + b, 0)
        return acc + (total)
      }
    } else {
      return acc
    }
  }, 0)
  copy.averageBlockDurationMinutes = Math.round(blockDuration / blockCount) || 0

  return copy
}


export const generateCurrentCourseTrends = async (courseId: string, teamId: string) => {
  const studentsDbRef = db.ref(COURSE_STATS).child(teamId).child(courseId).child("students")
  const snapshot = await studentsDbRef.once('value')
  let data: { [id: string]: StudentCourseStats } | null = snapshot.val()
  if (data) {
    const students = Object.entries(data).map(([key, value]) => ({ ...value, id: key, progress: value.progress ? value.progress : 0 }))
    const currentStats = calculateCurrentStats(students)
    console.log(currentStats)

    let date = moment().format('DD/MM/YYYY')
    const trendsDbRef = db.ref(COURSE_TRENDS).child(courseId)
    const trendSnapshot = await trendsDbRef.once('value')
    let trendsData: TrendStatistics | null = trendSnapshot.val()

    if (!trendsData) {
      trendsData = {
        active: {
          trends: [
            {
              date,
              value: currentStats.active
            }
          ],
          current: currentStats.active > 0 ? 100 : 0,
        },
        completed: {
          trends: [
            {
              date,
              value: currentStats.completed
            }
          ],
          current: currentStats.completed > 0 ? 100 : 0,
        },
        enrolled: {
          trends: [
            {
              date,
              value: currentStats.enrolled
            }
          ],
          current: currentStats.enrolled > 0 ? 100 : 0,
        },
        dropoutRate: {
          trends: [
            {
              date,
              value: currentStats.dropoutRate
            }
          ],
          current: currentStats.dropoutRate > 0 ? 100 : 0,
        },
        averageTestScore: {
          trends: [
            {
              date,
              value: currentStats.averageTestScore
            }
          ],
          current: currentStats.averageTestScore > 0 ? 100 : 0,
        },
        averageMcqRetakeRate: {
          trends: [
            {
              date,
              value: currentStats.averageMcqRetakeRate
            }
          ],
          current: currentStats.averageMcqRetakeRate > 0 ? 100 : 0,
        },
        averageBlockDurationMinutes: {
          trends: [
            {
              date,
              value: currentStats.averageBlockDurationMinutes
            }
          ],
          current: currentStats.averageBlockDurationMinutes > 0 ? 100 : 0,
        },
        averageCompletionMinutes: {
          trends: [
            {
              date,
              value: currentStats.averageCompletionMinutes
            }
          ],
          current: currentStats.averageCompletionMinutes > 0 ? 100 : 0,
        },
        averageCourseProgress: {
          trends: [
            {
              date,
              value: currentStats.averageCourseProgress
            }
          ],
          current: currentStats.averageCourseProgress > 0 ? 100 : 0,
        },
        averageLessonDurationMinutes: {
          trends: [
            {
              date,
              value: currentStats.averageLessonDurationMinutes
            }
          ],
          current: currentStats.averageLessonDurationMinutes > 0 ? 100 : 0,
        },
      }
    } else {
      let index = -1
      // handle active
      // calculate delta
      let older = trendsData.active.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.active.current = ((currentStats.active - last.value) / last.value) * 100
        }
      }
      index = trendsData.active.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.active.trends[index]) {
        // @ts-ignore
        trendsData.active.trends[index].value = currentStats.active
        index = -1
      } else {
        trendsData.active.trends.push({ date, value: currentStats.active })
      }

      // handle enrolled
      older = trendsData.enrolled.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.enrolled.current = ((currentStats.enrolled - last.value) / last.value) * 100
        }
      }
      trendsData.enrolled.current = currentStats.enrolled
      index = trendsData.enrolled.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.enrolled.trends[index]) {
        // @ts-ignore
        trendsData.enrolled.trends[index].value = currentStats.enrolled
        index = -1
      } else {
        trendsData.enrolled.trends.push({ date, value: currentStats.enrolled })
      }

      // handle completed
      older = trendsData.completed.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.completed.current = ((currentStats.completed - last.value) / last.value) * 100
        }
      }
      trendsData.completed.current = currentStats.completed
      index = trendsData.completed.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.completed.trends[index]) {
        // @ts-ignore
        trendsData.completed.trends[index].value = currentStats.completed
        index = -1
      } else {
        trendsData.completed.trends.push({ date, value: currentStats.completed })
      }
      // handle dropoutRate
      older = trendsData.dropoutRate.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.dropoutRate.current = ((currentStats.dropoutRate - last.value) / last.value) * 100
        }
      }
      trendsData.dropoutRate.current = currentStats.dropoutRate
      index = trendsData.dropoutRate.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.dropoutRate.trends[index]) {
        // @ts-ignore
        trendsData.dropoutRate.trends[index].value = currentStats.dropoutRate
        index = -1
      } else {
        trendsData.dropoutRate.trends.push({ date, value: currentStats.dropoutRate })
      }
      // handle averageTestScore
      older = trendsData.averageTestScore.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.averageTestScore.current = ((currentStats.averageTestScore - last.value) / last.value) * 100
        }
      }
      trendsData.averageTestScore.current = currentStats.averageTestScore
      index = trendsData.averageTestScore.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.averageTestScore.trends[index]) {
        // @ts-ignore
        trendsData.averageTestScore.trends[index].value = currentStats.averageTestScore
        index = -1
      } else {
        trendsData.averageTestScore.trends.push({ date, value: currentStats.averageTestScore })
      }
      // handle averageCompletionMinutes
      older = trendsData.averageCompletionMinutes.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.averageCompletionMinutes.current = ((currentStats.averageCompletionMinutes - last.value) / last.value) * 100
        }
      }
      trendsData.averageCompletionMinutes.current = currentStats.averageCompletionMinutes
      index = trendsData.averageCompletionMinutes.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.averageCompletionMinutes.trends[index]) {
        // @ts-ignore
        trendsData.averageCompletionMinutes.trends[index].value = currentStats.averageCompletionMinutes
        index = -1
      } else {
        trendsData.averageCompletionMinutes.trends.push({ date, value: currentStats.averageCompletionMinutes })
      }
      // handle averageCourseProgress
      older = trendsData.averageCourseProgress.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.averageCourseProgress.current = ((currentStats.averageCourseProgress - last.value) / last.value) * 100
        }
      }
      trendsData.averageCourseProgress.current = currentStats.averageCourseProgress
      index = trendsData.averageCourseProgress.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.averageCourseProgress.trends[index]) {
        // @ts-ignore
        trendsData.averageCourseProgress.trends[index].value = currentStats.averageCourseProgress
        index = -1
      } else {
        trendsData.averageCourseProgress.trends.push({ date, value: currentStats.averageCourseProgress })
      }
      // handle averageMcqRetakeRate
      older = trendsData.averageMcqRetakeRate.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.averageMcqRetakeRate.current = ((currentStats.averageMcqRetakeRate - last.value) / last.value) * 100
        }
      }
      trendsData.averageMcqRetakeRate.current = currentStats.averageMcqRetakeRate
      index = trendsData.averageMcqRetakeRate.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.averageMcqRetakeRate.trends[index]) {
        // @ts-ignore
        trendsData.averageMcqRetakeRate.trends[index].value = currentStats.averageMcqRetakeRate
        index = -1
      } else {
        trendsData.averageMcqRetakeRate.trends.push({ date, value: currentStats.averageMcqRetakeRate })
      }
      // handle averageLessonDurationMinutes
      older = trendsData.averageLessonDurationMinutes.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.averageLessonDurationMinutes.current = ((currentStats.averageLessonDurationMinutes - last.value) / last.value) * 100
        }
      }
      trendsData.averageLessonDurationMinutes.current = currentStats.averageLessonDurationMinutes
      index = trendsData.averageLessonDurationMinutes.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.averageLessonDurationMinutes.trends[index]) {
        // @ts-ignore
        trendsData.averageLessonDurationMinutes.trends[index].value = currentStats.averageLessonDurationMinutes
        index = -1
      } else {
        trendsData.averageLessonDurationMinutes.trends.push({ date, value: currentStats.averageLessonDurationMinutes })
      }
      // handle averageBlockDurationMinutes
      older = trendsData.averageBlockDurationMinutes.trends.filter(e => e.date !== date)
      if (older.length > 0) {
        let last = older[older.length - 1]
        if (last) {
          trendsData.averageBlockDurationMinutes.current = ((currentStats.averageBlockDurationMinutes - last.value) / last.value) * 100
        }
      }
      trendsData.averageBlockDurationMinutes.current = currentStats.averageBlockDurationMinutes
      index = trendsData.averageBlockDurationMinutes.trends.findIndex(e => e.date === date)
      if (index >= 0 && trendsData.averageBlockDurationMinutes.trends[index]) {
        // @ts-ignore
        trendsData.averageBlockDurationMinutes.trends[index].value = currentStats.averageBlockDurationMinutes
        index = -1
      } else {
        trendsData.averageBlockDurationMinutes.trends.push({ date, value: currentStats.averageBlockDurationMinutes })
      }
    }
    await trendsDbRef.set(trendsData)

  }
}
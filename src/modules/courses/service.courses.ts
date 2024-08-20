import { ApiError } from '../errors'
import httpStatus from 'http-status'
// import { QueryResult } from '../paginate/paginate'
import { QueryResult } from '../paginate/paginate'
import db from "../rtdb"
import { COURSE_STATS, COURSE_TRENDS } from '../rtdb/nodes'
import { CourseInterface, CourseStatus, CreateCoursePayload, Distribution, MediaType } from './interfaces.courses'
import Course from './model.courses'
import { CreateLessonPayload, LessonInterface } from './interfaces.lessons'
import Lessons from './model.lessons'
import { BlockInterface, CreateBlockPayload } from './interfaces.blocks'
import Blocks from './model.blocks'
import { CreateQuizPayload, QuizInterface } from './interfaces.quizzes'
import Quizzes from './model.quizzes'
import Settings from './model.settings'
import { CourseDisableDays, CourseSettings, DropoutEvents, LearnerGroup, LearnerGroupLaunchTime, PeriodTypes } from './interfaces.settings'
import Students from '../students/model.students'
import { StudentCourseStats } from '../students/interface.students'
import moment, { Moment } from 'moment-timezone'
import { CourseStatistics } from '../rtdb/interfaces.rtdb'
import { agenda } from '../scheduler'
import { DAILY_REMINDER, GENERATE_COURSE_OUTLINE_AI, GENERATE_COURSE_OUTLINE_FILE, RESUME_TOMORROW, SEND_SLACK_MESSAGE, SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { CourseEnrollment, DailyReminderNotificationPayload, Message } from '../webhooks/interfaces.webhooks'
import config from '../../config/config'
import { redisClient } from '../redis'
import { MessageActionButtonStyle, MessageBlockType, SendSlackMessagePayload, SlackActionType, SlackTextMessageTypes } from '../slack/interfaces.slack'
import { v4 } from 'uuid'
import Teams from '../teams/model.teams'
import randomstring from "randomstring"
import { generateOutlinePrompt, generateOutlinePromptDocument } from './prompts'
import { buildCourse } from '../ai/services'
import { sessionService } from '../sessions'
import { generatorService } from '../generators'
import { teamService } from '../teams'
import { handleExport, RowData } from '../utils/generateExcelSheet'
import { QuestionGroupsInterface, QuestionGroupsPayload } from './interfaces.question-group'
import QuestionGroup from './model.question-group'
import Enrollments from '../sessions/model'

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
  const team = await Teams.findById(teamId, 'name')
  if (team && (/consize/i.test(team.name))) {
    coursePayload.library = true
  }
  const course = new Course({
    ...coursePayload, owner: teamId, shortCode: randomstring.generate({
      length: 5,
      charset: "alphanumeric"
    }).toLowerCase()
  })
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
      value: 59,
      type: PeriodTypes.MINUTES
    },
    dropoutEvent: DropoutEvents.LESSON_COMPLETION,
    resumption: {
      days: 3,
      time: "08:00",
      enableImmediate: true,
      enabledDateTimeSetup: true
    },
    disableReminders: {
      sunday: false,
      saturday: false
    }
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
  return Course.paginate(q, { page, limit: pageSize, populate: 'lessons,courses', sortBy: 'updatedAt:desc' })

}

export const maxEnrollmentReached = async (settingsId: string, courseId: string, teamId: string) => {
  const dbRef = db.ref(COURSE_STATS).child(teamId).child(courseId).child("students")
  // get settings 
  const settings = await Settings.findById(settingsId)
  const snapshot = await dbRef.once('value')
  let data: { [id: string]: StudentCourseStats } | null = snapshot.val()
  let totalStudents = 0
  if (data) {
    totalStudents = Object.values(data).length
  }
  if (settings) {
    return totalStudents >= settings.metadata.maxEnrollments
  }
  return false

}


export const fetchPublishedCourses = async ({ page, pageSize, library, search, owner }: { page: number, pageSize: number, library?: boolean, search?: string, owner?: string }): Promise<QueryResult<CourseInterface>> => {
  let q: any = { $and: [{ status: CourseStatus.PUBLISHED }, { private: false }] }
  if (library) {
    q.$and.push({ $or: [{ library: true }] })
  }
  if (owner) {
    q.$and.push({ owner })
  }
  if (search) {
    const regex = new RegExp(search, "i")
    q.$and.push({ $or: [{ title: { $regex: regex } }, { description: { $regex: regex } }] })
  }
  return Course.paginate(q, { page, limit: pageSize, sortBy: 'createdAt:desc', populate: 'lessons,lessons.blocks,lessons.blocks.quiz,lessons.quizzes,courses,courses.lessons.blocks,courses.lessons.blocks.quiz,courses.lessons.quizzes' })
}

export const searchTeamCourses = async ({ teamId, search, filter }: { teamId: string, search: string, filter?: PageType }): Promise<CourseInterface[]> => {
  const q: any = { $and: [{ owner: teamId, }] }
  console.log(filter, teamId)
  if (filter) {
    switch (filter) {
      case PageType.ALL:
        q.$and.push({ $or: [{ status: CourseStatus.COMPLETED }, { status: CourseStatus.PUBLISHED }] })
        break
      case PageType.BUNDLE:
        q['bundle'] = true
        q.$and.push({ $or: [{ status: CourseStatus.COMPLETED }, { status: CourseStatus.PUBLISHED }] })
        break
      case PageType.COURSE:
        q['bundle'] = false
        q.$and.push({ $or: [{ status: CourseStatus.COMPLETED }, { status: CourseStatus.PUBLISHED }] })
        break
      case PageType.DRAFT:
        q.$and.push({ $or: [{ status: CourseStatus.DRAFT }] })
        break
      default:
        break
    }
  }
  const regex = new RegExp(search, "i")
  q.$and.push({ $or: [{ title: { $regex: regex } }, { description: { $regex: regex } }] })
  console.log(q)
  return Course.find({ ...q }).limit(16)

}

export const teamCoursesCount = async ({ teamId }: { teamId: string }): Promise<number> => {
  return Course.countDocuments({ owner: teamId })

}

export const fetchSingleTeamCourse = async ({ teamId, courseId }: { teamId: string, courseId: string }): Promise<CourseInterface | null> => {
  let course = await Course.findOne({ owner: teamId, _id: courseId }).populate({
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
  }).populate({
    path: "courses",
    populate: {
      path: "lessons",
      populate: {
        path: "blocks",
        populate: {
          path: "quiz"
        }
      }
    }
  }).populate({
    path: "courses",
    populate: {
      path: "lessons",
      populate: {
        path: "quizzes",
      }
    }
  }).lean()
  if (course) {
    if (!course.shortCode) {
      let code = randomstring.generate({
        length: 5,
        charset: "alphanumeric"
      }).toLowerCase()
      await Course.updateOne({ _id: courseId }, { $set: { shortCode: code } })
      course.shortCode = code
    }
  }
  return course
}


export const fetchSingleCourse = async ({ courseId }: { courseId: string }): Promise<CourseInterface | null> => {
  const course = await Course.findOne({ _id: courseId }).populate("lessons").populate("courses").populate('settings').populate('owner')
  return course
}

export const deleteCourse = async ({ courseId }: { courseId: string }): Promise<void> => {
  await Course.findByIdAndDelete(courseId)
}

export const generateCourseHeader = async ({ courseId }: { courseId: string }): Promise<string | null> => {
  const course = await Course.findById(courseId)
  if (course) {
    let owner = await teamService.fetchTeamById(course.owner)
    if (owner) {
      const url = await generatorService.generateCourseHeaderImage(course, owner)
      return url
    }
  }
  return null
}

export const duplicateCourse = async ({ courseId, title, headerMediaUrl, description }: { courseId: string, title: string, headerMediaUrl: string, description: string }): Promise<CourseInterface | null> => {
  const oldCourse = await Course.findOne({ _id: courseId })
  if (oldCourse) {
    let nTitle = ""
    let titleRegex = new RegExp(title)
    let existingNames = await Course.countDocuments({ title: { $regex: titleRegex, $options: "i" } })
    if (existingNames > 0) {
      nTitle = `${oldCourse.title} ${existingNames + 1}`
    } else {
      nTitle = title
    }
    let course = await createCourse({
      free: oldCourse.free,
      bundle: oldCourse.bundle,
      private: oldCourse.private,
      headerMedia: {
        mediaType: MediaType.IMAGE,
        url: headerMediaUrl
      },
      title: nTitle,
      description: description,
      source: oldCourse.source,
      price: oldCourse.price || 0,
      currentCohort: oldCourse.currentCohort || "",
      survey: oldCourse.survey || "",
      courses: oldCourse.courses || [],
    }, oldCourse.owner)
    if (!oldCourse.bundle && course) {
      for (let lessonId of oldCourse.lessons) {
        // duplicate the lesson
        let lesson = await Lessons.findById(lessonId).lean()
        if (lesson) {
          let newlesson = await createLesson({
            title: lesson.title,
            description: lesson.description || ""
          }, course.id)
          let blocks = await Blocks.find({ _id: { $in: lesson.blocks } })
          await Promise.all(blocks.map(async (e) => {
            let payload: CreateBlockPayload = {
              content: e.content,
              title: e.title,
            }
            if (e.bodyMedia) {
              payload.bodyMedia = e.bodyMedia
            }

            const block = await createBlock(payload, newlesson.id, courseId)
            if (e.quiz && block) {
              let old = await Quizzes.findById(e.quiz)
              if (old) {
                await addBlockQuiz({
                  question: old.question,
                  choices: old.choices,
                  revisitChunk: old.revisitChunk,
                  wrongAnswerContext: old.wrongAnswerContext,
                  correctAnswerContext: old.correctAnswerContext,
                  correctAnswerIndex: old.correctAnswerIndex,
                  hint: old.hint || ""
                }, lessonId, courseId, block.id)
              }

            }
            return e
          }))

          let quizzes = await Quizzes.find({ _id: { $in: lesson.quizzes } })
          await Promise.all(quizzes.map(async (e) => {
            if (e) {
              await addLessonQuiz({
                question: e.question,
                choices: e.choices,
                revisitChunk: e.revisitChunk,
                wrongAnswerContext: e.wrongAnswerContext,
                correctAnswerContext: e.correctAnswerContext,
                correctAnswerIndex: e.correctAnswerIndex,
                hint: e.hint || ""
              }, lessonId, courseId)
            }
            return e
          }))

        }
      }
    }
    if (oldCourse.status === CourseStatus.PUBLISHED) {
      course.status = CourseStatus.PUBLISHED
      await course.save()
    }
    return course

  }
  return null
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
export const addQuiz = async (quizPayload: CreateQuizPayload, course: string): Promise<QuizInterface> => {
  const quiz = new Quizzes({ ...quizPayload, course })
  await quiz.save()
  return quiz
}

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

export const fetchCourseQuestions = async ({ course, questionType}:{ course: string, questionType: any }): Promise<QuizInterface[]> => {
  const query:any = {
      course: course
    };
    
    if (questionType) {
      query.questionType = { $regex: new RegExp(questionType, 'i') };
    }

    const quizzes = await Quizzes.find(query).exec();
    return quizzes;
}

export const addQuestionGroup = async (questionGroupPayload: QuestionGroupsPayload,course: string ): Promise<QuestionGroupsInterface> => {
  const questionGroup = new QuestionGroup({ ...questionGroupPayload, course })
  await questionGroup.save()
  return questionGroup
}

export const fetchCourseQuestionGroups = async ({ course, type}:{ course: string, type: any }): Promise<QuestionGroupsInterface[]> => {
  const query:any = {
      course: course
    };
    
    if (type) {
      query.type = { $regex: new RegExp(type, 'i') };
    }

    const questionGroup = await QuestionGroup.find(query).exec();
    return questionGroup;
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


export const exportCourseStats = async (courseId: string): Promise<{ file: string, filename: string }> => {
  let course = await Course.findById(courseId)

  if (!course) throw new ApiError(httpStatus.NOT_FOUND, 'Could not find the specified course')
  let name = `course-report-${course.title}-${moment().format('DD-MM-YY hh:mm')}`
  const titles = [
    {
      v: "Student name",
      t: "s",
      s: {
        font: {
          bold: true,
          sz: 15
        }
      }
    },
    {
      v: "Delivery Medium",
      t: "s",
      s: {
        font: {
          sz: 15,
          bold: true
        }
      }
    },
    {
      v: "Phone number",
      t: "s",
      s: {
        font: {
          sz: 15,
          bold: true
        }
      }
    },
    {
      v: "Slack ID",
      t: "s",
      s: {
        font: {
          sz: 15,
          bold: true
        }
      }
    }
  ]


  const fields: {
    field: keyof CourseStatistics,
    description: string,
    title: string
    unit: string
  }[] = [
      { description: 'Total number of students who registered on the course', unit: "", field: "enrolled", title: "Enrolled students" },
      { description: 'No. of users who are still in between the course', unit: "", field: "active", title: "Active students" },
      { description: 'No. of users who have completed the course', unit: "", field: "completed", title: "Completed students" },
      { description: 'No. of users who have dropped out of this course', unit: "", field: "dropouts", title: "Students dropped out" },
      { description: 'The scores achieved for all the quizzes in the course, averaged over all enrolled students', unit: "", field: "averageTestScore", title: "Avg. test score" },
      { description: 'Time taken to complete the course averaged over all enrolled students', unit: "minutes", field: "averageCompletionMinutes", title: "Avg. completion time" },
      { description: 'The extent of course completed by student averaged over all enrolled students', unit: "%", field: "averageCourseProgress", title: "Avg. course progress" },
      { description: 'The percentage of quiz questions that the students got wrong in the first attempt and then took another attempt', unit: "%", field: "averageMcqRetakeRate", title: "Avg. MCQ retake rates" },
      { description: 'Time taken to complete a lesson, averaged over all enrolled users', unit: "minutes", field: "averageLessonDurationMinutes", title: "Avg. lesson duration" },
      { description: 'Avg. Time taken to complete a section in the course, averaged over all users', unit: "minutes", field: "averageBlockDurationMinutes", title: "Avg. section duration" },
    ]

  let stats: CourseStatistics = {
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

  const enrollments = await Enrollments.find({ courseId })

  let quizes = 0
  const scores = enrollments.reduce((acc, curr) => {
    if (curr.scores && curr.scores.length > 0) {
      quizes = Math.max(curr.scores.length, quizes)
      let total = curr.scores.reduce((a, b) => a + b, 0)
      return acc + total
    } else {
      return acc
    }
  }, 0)
  stats.enrolled = enrollments.length
  stats.active = enrollments.filter(e => !e.completed && !e.droppedOut).length
  stats.dropoutRate = (enrollments.filter(e => e.droppedOut).length / stats.enrolled) * 100
  stats.completed = enrollments.filter(e => e.completed).length
  stats.averageTestScore = isNaN(scores / quizes) ? 0 : (((scores / quizes) * 100) / enrollments.length)

  stats.averageCourseProgress = enrollments.reduce((acc, curr) => {
    if (curr.progress) {
      return acc + curr.progress
    } else {
      return acc
    }
  }, 0) / enrollments.length

  stats.averageCompletionMinutes = enrollments.filter(e => e.completed).reduce((acc, curr) => {
    if (curr.lessons) {
      const lessons = Object.values(curr.lessons)
      if (lessons.length === 0) {
        return acc
      } else {
        let total = 0
        for (let lesson of lessons) {
          if (lesson.blocks) {
            let value = Object.values(lesson.blocks).reduce((acc, curr) => acc + curr.duration, 0)
            total += value
          }
        }
        return acc + (total / 60)
      }
    } else {
      return acc
    }
  }, 0) / enrollments.filter(e => e.completed).length

  let quizCount = 0
  let retakes = enrollments.reduce((acc, curr) => {
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
  stats.averageMcqRetakeRate = isNaN(retakes / quizCount) ? 0 : retakes / quizCount

  let lessonCount = 0
  let lessonDuration = enrollments.reduce((acc, curr) => {
    if (curr.lessons) {
      const lessons = Object.values(curr.lessons)
      if (lessons.length === 0) {
        return acc
      } else {
        lessonCount += lessons.length
        let total = 0
        for (let lesson of lessons) {
          if (lesson.blocks) {
            let value = Object.values(lesson.blocks).reduce((acc, curr) => acc + curr.duration, 0)
            total += value
          }
        }
        return acc + (total / 60)
      }
    } else {
      return acc
    }
  }, 0)

  stats.averageLessonDurationMinutes = isNaN(lessonDuration / lessonCount) ? 0 : lessonDuration / lessonCount

  let blockCount = 0
  let blockDuration = enrollments.reduce((acc, curr) => {
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
  stats.averageBlockDurationMinutes = isNaN(blockDuration / blockCount) ? 0 : blockDuration / blockCount

  const statsData: RowData[][] = [
    [
      {
        v: "Title",
        t: "s",
        s: {
          font: {
            bold: true,
            sz: 15
          }
        }
      },
      {
        v: "Value",
        t: "s",
        s: {
          font: {
            sz: 15,
            bold: true,
          }
        }
      },
      {
        v: "Description",
        t: "s",
        s: {
          font: {
            sz: 15,
            bold: true,
          }
        }
      }
    ],
    ...fields.map((field) => {
      return [
        {
          v: field.title,
          t: "s",
          s: {
            font: {
              bold: true
            }
          }
        },
        { //@ts-ignore
          v: (stats[field.field] ? stats[field.field].toFixed(1) : 0) + field.unit,
          t: "s",
          s: {
            alignment: {
              horizontal: 'left',
              vertical: 'center',
            },
          }
        },
        { //@ts-ignore
          v: field.description,
          t: "s",
        },

      ]
    })
  ]
  const tableData: RowData[][] = [
    [
      ...titles,
      {
        v: "Total lessons completed",
        t: "s",
        s: {
          font: {
            sz: 15,
            bold: true
          },
        }
      },
      {
        v: "Progress",
        t: "s",
        s: {
          font: {
            sz: 15,
            bold: true
          }
        }
      },
      {
        v: "Performance",
        t: "s",
        s: {
          font: {
            sz: 15,
            bold: true
          }
        }
      },
      {
        v: "Status",
        t: "s",
        s: {
          font: {
            sz: 15,
            bold: true
          },
        }
      },
    ],
    ...enrollments.map((enrollment) => {
      let lessons = Object.entries(enrollment.lessons)
      let scores = enrollment.scores
      let total = scores.reduce((a, b) => a + b, 0)
      return [
        {
          v: enrollment.name,
          t: "s",
          s: {
            font: {
              bold: true
            }
          }
        },
        {
          v: enrollment.distribution || Distribution.WHATSAPP,
          t: "s",
          s: {
            font: {
              bold: true
            }
          }
        },
        {
          v: enrollment.phoneNumber,
          t: "s",
          s: {
            alignment: {
              horizontal: 'left',
              vertical: 'center',
            },
            font: {
              bold: true
            }
          }
        },
        {
          v: enrollment.slackId || "",
          t: "s",
          s: {
            alignment: {
              horizontal: 'left',
              vertical: 'center',
            },
            font: {
              bold: true
            }
          }
        },
        {
          v: lessons.length.toFixed(0) || "0",
          t: "s",
          s: {
            alignment: {
              horizontal: 'left',
              vertical: 'center',
            },
            font: {
              bold: true
            }
          }
        },
        {
          v: (enrollment.progress.toFixed(1) || "") + "%",
          t: "s",
          s: {
            alignment: {
              horizontal: 'left',
              vertical: 'center',
            },
            font: {
              bold: true
            }
          }
        },
        {
          v: (scores.length > 0 ? ((total / scores.length) * 100).toFixed(1) : '0') + "%",
          t: "s",
          s: {
            alignment: {
              horizontal: 'left',
              vertical: 'center',
            },
            font: {
              bold: true
            }
          }
        },
        {
          v: enrollment.droppedOut ? 'Dropped out' : enrollment.completed ? 'Completed' : 'Active',
          t: "s",
          s: {
            alignment: {
              horizontal: 'left',
              vertical: 'center',
            },
            font: {
              bold: true
            }
          }
        },
      ]
    })
  ]
  const path = await handleExport({
    name,
    statsData,
    tableData
  })
  return {
    file: path,
    filename: name
  }

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
  copy.averageBlockDurationMinutes = blockDuration / blockCount

  return copy
}

function replaceNaNInfinityNull (obj: {
  enrolled: number
  active: number
  completed: number
  dropoutRate: number
  averageTestScore: number
  averageCompletionMinutes: number
  averageCourseProgress: number
  averageMcqRetakeRate: number
  averageLessonDurationMinutes: number
  averageBlockDurationMinutes: number
}) {
  for (let key in obj) {
    // @ts-ignore
    if (typeof obj[key] === 'number' && (isNaN(obj[key]) || !isFinite(obj[key]) || obj[key] === null)) {
      // @ts-ignore
      obj[key] = 0
    }
  }
  return obj
}


export const generateCurrentCourseTrends = async (courseId: string, teamId: string) => {
  const studentsDbRef = db.ref(COURSE_STATS).child(teamId).child(courseId).child("students")
  const snapshot = await studentsDbRef.once('value')
  let data: { [id: string]: StudentCourseStats } | null = snapshot.val()
  if (data) {
    const students = Object.entries(data).map(([key, value]) => ({ ...value, id: key, progress: value.progress ? value.progress : 0 }))
    let currentStats = replaceNaNInfinityNull(calculateCurrentStats(students))


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
          current: currentStats.completed > 0 ? 100 : 0,
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
          if (last.value === currentStats.active) {
            trendsData.active.current = ((currentStats.active - last.value)) * 100
          } else {
            trendsData.active.current = ((currentStats.active - last.value) / last.value) * 100
          }
        }
        if (isNaN(trendsData.active.current) || !isFinite(trendsData.active.current)) {
          trendsData.active.current = 0
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
          if (last.value === currentStats.enrolled) {
            trendsData.enrolled.current = ((currentStats.enrolled - last.value)) * 100
          } else {
            trendsData.enrolled.current = ((currentStats.enrolled - last.value) / last.value) * 100
          }
        }
        if (isNaN(trendsData.enrolled.current) || !isFinite(trendsData.enrolled.current)) {
          trendsData.enrolled.current = 0
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
          if (last.value === currentStats.completed) {
            trendsData.completed.current = ((currentStats.completed - last.value)) * 100
          } else {
            trendsData.completed.current = ((currentStats.completed - last.value) / last.value) * 100
          }
        }
        if (isNaN(trendsData.completed.current) || !isFinite(trendsData.completed.current)) {
          trendsData.completed.current = 0
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
          if (last.value === currentStats.dropoutRate) {
            trendsData.dropoutRate.current = ((currentStats.dropoutRate - last.value)) * 100
          } else {
            trendsData.dropoutRate.current = ((currentStats.dropoutRate - last.value) / last.value) * 100
          }
        }
        if (isNaN(trendsData.dropoutRate.current) || !isFinite(trendsData.dropoutRate.current)) {
          trendsData.dropoutRate.current = 0
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
          if (last.value === currentStats.averageTestScore) {
            trendsData.averageTestScore.current = ((currentStats.averageTestScore - last.value)) * 100
          } else {
            trendsData.averageTestScore.current = ((currentStats.averageTestScore - last.value) / last.value) * 100
          }
        }
        if (isNaN(trendsData.averageTestScore.current) || !isFinite(trendsData.averageTestScore.current)) {
          trendsData.averageTestScore.current = 0
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
          if (last.value === currentStats.averageCompletionMinutes) {
            trendsData.averageCompletionMinutes.current = currentStats.completed > 0 ? (((currentStats.averageCompletionMinutes - last.value)) * 100) : 0
          } else {
            trendsData.averageCompletionMinutes.current = currentStats.completed > 0 ? (((currentStats.averageCompletionMinutes - last.value) / last.value) * 100) : 0
          }
        }
        if (isNaN(trendsData.averageCompletionMinutes.current) || !isFinite(trendsData.averageCompletionMinutes.current)) {
          trendsData.averageCompletionMinutes.current = 0
        }
      }
      trendsData.averageCompletionMinutes.current = currentStats.completed > 0 ? currentStats.averageCompletionMinutes : 0
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
          if (last.value === currentStats.averageCourseProgress) {
            trendsData.averageCourseProgress.current = ((currentStats.averageCourseProgress - last.value)) * 100
          } else {
            trendsData.averageCourseProgress.current = ((currentStats.averageCourseProgress - last.value) / last.value) * 100
          }
        }
        if (isNaN(trendsData.averageCourseProgress.current) || !isFinite(trendsData.averageCourseProgress.current)) {
          trendsData.averageCourseProgress.current = 0
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
          if (last.value === currentStats.averageMcqRetakeRate) {
            trendsData.averageMcqRetakeRate.current = ((currentStats.averageMcqRetakeRate - last.value)) * 100
          } else {
            trendsData.averageMcqRetakeRate.current = ((currentStats.averageMcqRetakeRate - last.value) / last.value) * 100
          }
        }
        if (isNaN(trendsData.averageMcqRetakeRate.current) || !isFinite(trendsData.averageMcqRetakeRate.current)) {
          trendsData.averageMcqRetakeRate.current = 0
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
          if (last.value === currentStats.averageLessonDurationMinutes) {
            trendsData.averageLessonDurationMinutes.current = ((currentStats.averageLessonDurationMinutes - last.value)) * 100
          } else {
            trendsData.averageLessonDurationMinutes.current = ((currentStats.averageLessonDurationMinutes - last.value) / last.value) * 100
          }
        }
        if (isNaN(trendsData.averageLessonDurationMinutes.current) || !isFinite(trendsData.averageLessonDurationMinutes.current)) {
          trendsData.averageLessonDurationMinutes.current = 0
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
          if (last.value === currentStats.averageBlockDurationMinutes) {
            trendsData.averageBlockDurationMinutes.current = ((currentStats.averageBlockDurationMinutes - last.value)) * 100
          } else {
            trendsData.averageBlockDurationMinutes.current = ((currentStats.averageBlockDurationMinutes - last.value) / last.value) * 100
          }
        }
        if (isNaN(trendsData.averageBlockDurationMinutes.current) || !isFinite(trendsData.averageBlockDurationMinutes.current)) {
          trendsData.averageBlockDurationMinutes.current = 0
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

export const handleStudentSlack = async ({ studentId, courseId, settingsId, last }: DailyReminderNotificationPayload) => {
  // check if there is a RESUME_TOMORROW event scheduled for this student
  const jobs = await agenda.jobs({
    name: RESUME_TOMORROW,
    'data.enrollment.student': studentId,
    nextRunAt: { $ne: null }
  })
  if (jobs.length > 0) {
    return
  }
  let settings = await Settings.findById(settingsId)
  let msgId = v4()
  if (settings) {
    // get student info
    let student = await Students.findById(studentId)
    if (student && student.channelId) {
      // redis key
      const key = `${config.redisBaseKey}enrollments:slack:${student.channelId}:${courseId}`
      let dt = await redisClient.get(key)
      if (dt) {
        const enrollment: CourseEnrollment | null = JSON.parse(dt)
        if (enrollment && enrollment.slackToken) {
          if (enrollment.totalBlocks === enrollment.currentBlock) {
            return
          }
          let lastActivity: Moment
          if (!enrollment.lastActivity) {
            lastActivity = moment().subtract(1, "day").startOf('day')
          } else {
            lastActivity = moment(enrollment.lastActivity)
          }
          let daysSinceLastActivity = moment().diff(lastActivity, "days")

          let lastLessonCompleted: Moment
          if (!enrollment.lastLessonCompleted) {
            lastLessonCompleted = moment().subtract(1, "day").startOf('day')
          } else {
            lastLessonCompleted = moment(enrollment.lastLessonCompleted)
          }
          let daysSinceLastLesson = moment().diff(lastLessonCompleted, "days")

          if (moment().isAfter(lastActivity)) {
            if (daysSinceLastActivity < settings.reminderDuration.value) {
              // send a reminder

              agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
                channel: student.channelId,
                accessToken: enrollment.slackToken || "",
                message: {
                  blocks: [
                    {
                      type: MessageBlockType.SECTION,
                      text: {
                        type: SlackTextMessageTypes.MARKDOWN,
                        text: `Hey ${student.firstName}! You have made ${((enrollment.nextBlock / enrollment.totalBlocks) * 100).toFixed(0)}% progress in the course ${enrollment.title}.🎉\n\nContinue now to learn more from the course 🎯.`
                      },
                    },
                    {
                      type: MessageBlockType.ACTIONS,
                      elements: [
                        {
                          "type": SlackActionType.BUTTON,
                          "text": {
                            "type": SlackTextMessageTypes.PLAINTEXT,
                            "text": "Continue",
                            "emoji": true
                          },
                          "value": `continue_${enrollment.id}`,
                          style: MessageActionButtonStyle.PRIMARY
                        }
                      ]
                    }
                  ]
                }
              })
            }
            if (last) {
              let dropout = false
              if (settings.dropoutEvent === DropoutEvents.INACTIVITY) {

                if (daysSinceLastActivity >= settings.dropoutWaitPeriod.value) {
                  // send drop out message
                  dropout = true
                }

              } else {

                if (daysSinceLastLesson >= settings.dropoutWaitPeriod.value) {
                  // send drop out message
                  dropout = true
                }
              }

              if (dropout) {
                agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
                  channel: student.channelId,
                  accessToken: enrollment.slackToken || "",
                  message: {
                    blocks: [
                      {
                        type: MessageBlockType.SECTION,
                        text: {
                          type: SlackTextMessageTypes.MARKDOWN,
                          text: `This is to remind you of your ongoing progress in the following course \n\n*${enrollment.title}*\n\n${enrollment.description}\n\n*Progress*: ${((enrollment.nextBlock / enrollment.totalBlocks) * 100).toFixed(0)}%\n\nDo you wish to drop out of this course?`
                        },
                      },
                      {
                        type: MessageBlockType.ACTIONS,
                        elements: [
                          {
                            "type": SlackActionType.BUTTON,
                            "text": {
                              "type": SlackTextMessageTypes.PLAINTEXT,
                              "text": "Continue",
                              "emoji": true
                            },
                            "value": `continue_${enrollment.id}|${msgId}`,
                            style: MessageActionButtonStyle.PRIMARY
                          },
                          {
                            "type": SlackActionType.BUTTON,
                            "text": {
                              "type": SlackTextMessageTypes.PLAINTEXT,
                              "text": "Dropout",
                              "emoji": true
                            },
                            "value": `dropout_${enrollment.id}|${msgId}`,
                            style: MessageActionButtonStyle.PRIMARY
                          }
                        ]
                      }
                    ]
                  }
                })
              }
            }
            // update redis record
            enrollment.lastActivity = lastActivity.toISOString()
            enrollment.lastLessonCompleted = lastLessonCompleted.toISOString()
            await redisClient.set(key, JSON.stringify({ ...enrollment, lastMessageId: msgId }))
          }
        }
      }

    }
  }
}
export const handleStudentWhatsapp = async ({ courseId, studentId, settingsId, last }: DailyReminderNotificationPayload) => {
  const jobs = await agenda.jobs({
    name: RESUME_TOMORROW,
    'data.enrollment.student': studentId,
    nextRunAt: { $ne: null }
  })
  if (jobs.length > 0) {
    return
  }
  let settings = await Settings.findById(settingsId)
  let msgId = v4()
  if (settings) {
    // get student info
    let student = await Students.findById(studentId)
    if (student && student.phoneNumber) {
      // redis key
      const key = `${config.redisBaseKey}enrollments:${student.phoneNumber}:${courseId}`
      let dt = await redisClient.get(key)
      if (dt) {
        const enrollment: CourseEnrollment | null = JSON.parse(dt)
        if (enrollment) {
          if (enrollment.totalBlocks === enrollment.currentBlock) {
            return
          }
          let lastActivity: Moment
          if (!enrollment.lastActivity) {
            lastActivity = moment().subtract(1, "day").startOf('day')
          } else {
            lastActivity = moment(enrollment.lastActivity)
          }
          let daysSinceLastActivity = moment().diff(lastActivity, "days")

          let lastLessonCompleted: Moment
          if (!enrollment.lastLessonCompleted) {
            lastLessonCompleted = moment().subtract(1, "day").startOf('day')
          } else {
            lastLessonCompleted = moment(enrollment.lastLessonCompleted)
          }
          let daysSinceLastLesson = moment().diff(lastLessonCompleted, "days")

          if (moment().isAfter(lastActivity)) {
            if (daysSinceLastActivity < settings.reminderDuration.value) {
              // send a reminder
              agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                to: student.phoneNumber,
                type: "interactive",
                messaging_product: "whatsapp",
                recipient_type: "individual",
                interactive: {
                  body: {
                    text: `Hey ${student.firstName}! You have made ${((enrollment.nextBlock / enrollment.totalBlocks) * 100).toFixed(0)}% progress in the course ${enrollment.title}.🎉\n\nContinue now to learn more from the course 🎯.`
                  },
                  type: "button",
                  action: {
                    buttons: [
                      {
                        type: "reply",
                        reply: {
                          id: `continue_${enrollment.id}`,
                          title: "Continue"
                        }
                      }
                    ]
                  }
                }
              })
            }
            if (last) {
              let dropout = false
              if (settings.dropoutEvent === DropoutEvents.INACTIVITY) {

                if (daysSinceLastActivity >= settings.dropoutWaitPeriod.value) {
                  // send drop out message
                  dropout = true
                }

              } else {

                if (daysSinceLastLesson >= settings.dropoutWaitPeriod.value) {
                  // send drop out message
                  dropout = true
                }
              }

              if (dropout) {
                agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                  to: student.phoneNumber,
                  type: "interactive",
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  interactive: {
                    body: {
                      text: `This is to remind you of your ongoing progress in the following course \n\n*${enrollment.title}*\n\n${enrollment.description}\n\n*Progress*: ${((enrollment.nextBlock / enrollment.totalBlocks) * 100).toFixed(0)}%\n\nDo you wish to drop out of this course?`
                    },
                    type: "button",
                    action: {
                      buttons: [
                        {
                          type: "reply",
                          reply: {
                            id: `continue_${enrollment.id}`,
                            title: "Continue"
                          }
                        },
                        {
                          type: "reply",
                          reply: {
                            id: `dropout_${enrollment.id}`,
                            title: "Dropout"
                          }
                        }
                      ]
                    }
                  }
                })
              }
            }
            // update redis record
            enrollment.lastActivity = lastActivity.toISOString()
            enrollment.lastLessonCompleted = lastLessonCompleted.toISOString()
            await redisClient.set(key, JSON.stringify({ ...enrollment, lastMessageId: msgId, owedLessonsCount: enrollment.owedLessonsCount + (enrollment.maxLessonsPerDay - enrollment.dailyLessonsCount), dailyLessonsCount: enrollment.dailyLessonsCount }))
          }
        }
      }

    }
  }
}

const handleCourseReminders = async (courseId: string, ownerId: string, settingsId: string, distribution?: Distribution) => {
  const dbRef = db.ref(COURSE_STATS).child(ownerId).child(courseId).child('students')
  // get settings
  const settings = await Settings.findById(settingsId)
  let day = moment().format('dddd').toLowerCase() as keyof CourseDisableDays
  if (settings) {
    if (settings.disableReminders && settings.disableReminders.hasOwnProperty(day)) {
      if (settings.disableReminders[day]) {
        return
      }
    }
    const snapshot = await dbRef.once('value')
    let data: { [studentId: string]: StudentCourseStats } | null = snapshot.val()
    if (data) {
      const students = Object.entries(data).map(([_, value]) => ({ ...value }))
      await Promise.allSettled(students.filter(e => !e.completed).map(async (student) => {
        // get the student's timezone
        const studentInfo = await Students.findById(student.studentId)
        if (studentInfo) {
          let identifier: string | null = null
          if (studentInfo.channelId) {
            identifier = studentInfo.channelId
          } else {
            identifier = studentInfo.phoneNumber
          }
          if (identifier) {
            const key = `${config.redisBaseKey}enrollments:${identifier}:${courseId}`
            const enrollmentRaw = await redisClient.get(key)
            let enrollment: CourseEnrollment | null = null
            if (enrollmentRaw) {
              enrollment = JSON.parse(enrollmentRaw)
            }

            if (enrollment && enrollment.active) {
              let count = enrollment.reminderDaysCount || 0
              if (count < settings.reminderDuration.value) {
                let today = moment().format('YYYY-MM-DD')
                settings.reminderSchedule.map((schedule, index) => {
                  const dateTimeString = `${today} ${schedule}` // Note: removed 'PM'
                  const now = moment.tz(studentInfo.tz)
                  const time = moment(dateTimeString).subtract(now.utcOffset(), 'minutes')
                  agenda.schedule<DailyReminderNotificationPayload>(time.toDate(), DAILY_REMINDER, {
                    courseId, studentId: student.studentId, settingsId, distribution: distribution || Distribution.WHATSAPP, ownerId, last: index === settings.reminderSchedule.length
                  })
                })
                count++
                await redisClient.set(key, JSON.stringify({ ...enrollment, reminderDaysCount: count }))
              }
            }


          }
        }
        return student
      }))
    }
  }
}


export const initiateDailyRoutine = async () => {
  const courses = await Course.find({ status: CourseStatus.PUBLISHED })
  Promise.allSettled(courses.map((course) => handleCourseReminders(course.id, course.owner, course.settings)))
  const now = new Date()
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000) // 48 hours ago

  try {
    const result = await agenda.cancel({
      lastFinishedAt: { $lt: cutoff }
    })

    console.log(`Purged ${result} completed tasks older than 48 hours.`)
  } catch (error) {
    console.error('Error purging completed tasks:', error)
  }
}

export const handleSendReminders = async (courseId: string, studentId: string) => {
  console.log(courseId, studentId)
}

export const handleSendDropoutMessage = async (courseId: string, studentId: string) => {
  console.log(courseId, studentId)
}

export const resolveTeamCourseWithShortcode = async (code: string) => {
  const team = await Teams.findOne({ shortCode: code })
  let courses: CourseInterface[] = []
  let name = ""
  if (team) {
    name = team.name
    courses = await Course.find({ owner: team.id, status: CourseStatus.PUBLISHED, private: false }).limit(10)
  }

  return { courses, name }
}


export const resolveCourseWithShortcode = async (code: string) => {
  let course: CourseInterface | null = await Course.findOne({ shortCode: code })

  return course
}

// AI course creation
export const createAICourse = async function ({ jobId, teamId }: { jobId: string, teamId: string }) {
  // create the course, get the course id
  const course = await buildCourse(jobId, teamId)
  return course
}


export const generateCourseOutlineAI = async function ({ title, lessonCount, jobId }: { title: string, lessonCount: number, jobId?: string }) {
  // create the course, get the course id
  let id
  if (jobId) {
    id = jobId
  } else {
    id = v4()
  }
  const prompt = generateOutlinePrompt(title, lessonCount)
  agenda.now<{ courseId: string, prompt: string, title: string, lessonCount: number }>(GENERATE_COURSE_OUTLINE_AI, {
    courseId: id,
    prompt,
    title,
    lessonCount
  })
  return {
    id,
    title,
    lessonCount
  }
}

export const generateCourseOutlineFile = async function ({ title, jobId, files, teamId }: { title: string, files: string[], teamId: string, jobId?: string }) {
  // create the course, get the course id
  let id
  if (jobId) {
    id = jobId
  } else {
    id = v4()
  }
  const prompt = generateOutlinePromptDocument(title)
  agenda.now<{ jobId: string, prompt: string, title: string, files: string[], teamId: string }>(GENERATE_COURSE_OUTLINE_FILE, {
    jobId: id,
    prompt,
    title,
    files,
    teamId
  })
  return {
    id,
    title
  }
}

export const synStudentCourseEnrollment = async function (courseId: string, teamId: string) {
  const dbRef = db.ref(COURSE_STATS).child(teamId).child(courseId).child("students")
  const snapshot = await dbRef.once('value')
  let data: { [id: string]: StudentCourseStats } | null = snapshot.val()
  if (data) {
    for (let studentRecord of Object.values(data)) {
      await sessionService.createEnrollment({
        courseId,
        lessons: studentRecord.lessons,
        anonymous: studentRecord.anonymous,
        name: studentRecord.name,
        phoneNumber: studentRecord.phoneNumber,
        progress: studentRecord.progress,
        scores: studentRecord.scores,
        studentId: studentRecord.studentId,
        teamId,
        certificate: studentRecord.certificate || "",
        completed: studentRecord.completed || false,
        distribution: studentRecord.distribution || Distribution.WHATSAPP,
        droppedOut: studentRecord.droppedOut || false
      })
    }
  }
}
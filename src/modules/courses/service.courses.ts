import { ApiError } from '../errors'
import httpStatus from 'http-status'
// import { QueryResult } from '../paginate/paginate'
import { QueryResult } from '../paginate/paginate'
import db from "../rtdb"
import { CourseStatistics } from '../rtdb/interfaces.rtdb'
import { COURSE_STATS } from '../rtdb/nodes'
import { CourseInterface, CreateCoursePyaload } from './interfaces.courses'
import Course from './model.courses'
import { CreateLessonPyaload, LessonInterface } from './interfaces.lessons'
import Lessons from './model.lessons'
import { BlockInterface, CreateBlockPyaload } from './interfaces.blocks'
import Blocks from './model.blocks'
import { CreateQuizPyaload, QuizInterface } from './interfaces.quizzes'
import Quizzes from './model.quizzes'


export const createCourse = async (coursePayload: CreateCoursePyaload, teamId: string): Promise<CourseInterface> => {
  const dbRef = db.ref(COURSE_STATS)
  const course = new Course({ ...coursePayload, owner: teamId })
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
  await dbRef.child(course.id).set(initialStats)
  await course.save()
  return course
}

export const updateCourse = async (coursePayload: Partial<CreateCoursePyaload>, courseId: string, teamId: string): Promise<CourseInterface> => {
  const course = await Course.findOneAndUpdate({ _id: courseId, owner: teamId }, { $set: { ...coursePayload } }, { new: true })
  if (!course) throw new ApiError(httpStatus.NOT_FOUND, 'Could not update the specified course')
  return course
}

export const fetchTeamCourses = async ({ teamId, page, pageSize, search }: { teamId: string, page: number, pageSize: number, search?: string }): Promise<QueryResult<CourseInterface>> => {
  if (search) {
    const regex = new RegExp(search, "i")
    return Course.paginate({ owner: teamId, $or: [{ title: { $regex: regex } }, { description: { $regex: regex } }] }, { page, limit: pageSize, populate: 'lessons,courses' })
  } else {
    return Course.paginate({ owner: teamId }, { page, limit: pageSize, populate: 'lessons,courses' })
  }

}

export const fetchSingleTeamCourse = async ({ teamId, courseId }: { teamId: string, courseId: string }): Promise<CourseInterface | null> => {
  return Course.findOne({ owner: teamId, _id: courseId }).populate("lessons").populate("courses")
}

// lessons

export const createLesson = async (lessonPayload: CreateLessonPyaload, course: string): Promise<LessonInterface> => {
  const lesson = new Lessons({ ...lessonPayload, course })
  await Course.findByIdAndUpdate(course, { $push: { lessons: lesson.id } })
  await lesson.save()
  return lesson
}


export const fetchCourseLessons = async ({ course }: { course: string }): Promise<LessonInterface[]> => {
  const results = await Lessons.find({ course }).populate("blocks").populate("course")
  return results
}

export const fetchSingleLesson = async ({ lesson }: { lesson: string }): Promise<LessonInterface | null> => {
  return Lessons.findById(lesson).populate("blocks").populate("course")
}


// blocks


export const createBlock = async (blockPayload: CreateBlockPyaload, lesson: string, course: string): Promise<BlockInterface> => {
  const block = new Blocks({ ...blockPayload, lesson, course })
  await Lessons.findByIdAndUpdate(lesson, { $push: { blocks: block.id } })
  await block.save()
  return block
}


export const fetchLessonsBlocks = async ({ course, lesson }: { course: string, lesson: string }): Promise<BlockInterface[]> => {
  const results = await Blocks.find({ course, lesson }).populate("quiz").populate("lesson").populate("course")
  return results
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

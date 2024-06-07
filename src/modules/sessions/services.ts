import { StudentCourseStats } from '../students/interface.students'
import Enrollments from './model'
import { EnrollmentSession } from './sessions.interface'

export const createEnrollment = async function (value: EnrollmentSession) {
  await Enrollments.updateOne({ studentId: value.studentId, courseId: value.courseId }, value, { upsert: true })
}

export const updateEnrollment = async function (studentId: string, courseId: string, payload: Partial<StudentCourseStats>) {
  await Enrollments.updateOne({ studentId, courseId }, { $set: payload })
}

export const countTeamEnrollmentsPerMonth = async function (teamId: string, month: number, year: number): Promise<number> {
  const result = await Enrollments.countDocuments({
    teamId,
    createdAt: {
      $gte: new Date(year, month, 1), // Start of the month
      $lt: new Date(year, month + 1, 1), // Start of the next month
    }
  })

  // Return the total count
  return result
}

export const countCourseEnrollments = async function (courseId: string): Promise<number> {
  const result = await Enrollments.countDocuments({ courseId })
  // Return the total count
  return result
}
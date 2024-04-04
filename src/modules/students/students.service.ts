import httpStatus from 'http-status'
import ApiError from '../errors/ApiError'
import Students from './model.students'
import { Student, StudentInterface } from './interface.students'

export const bulkAddStudents = async (students: Student[]): Promise<StudentInterface[]> => {
  try {
    await Students.updateMany({ email: { $in: students.map(e => e.email) } }, students, { upsert: true })
    return Students.find({ email: { $in: students.map(e => e.email) } })
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
}

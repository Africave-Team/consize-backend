import httpStatus from 'http-status'
import ApiError from '../errors/ApiError'
import Students from './model.students'
import { Student } from './interface.students'

export const bulkAddStudents = async (students: Student[]): Promise<string[]> => {
  try {
    const studentIds: string[] = []
    for (let student of students) {
      let result = await Students.findOne({ phoneNumber: student.phoneNumber })
      if (result) {
        studentIds.push(result.id)
      } else {
        result = await Students.create(student)
        studentIds.push(result.id)
      }
    }
    return studentIds
  } catch (error) {

    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

import httpStatus from 'http-status'
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { studentService } from './'

export const getAllStudents = catchAsync(async (req: Request, res: Response) => {
  const students = await studentService.getAllStudents(req.user.team, parseInt(req.query['page'] as string, 10) || 1)
  res.status(httpStatus.OK).send({ data: students, message: "students retrieved" })
})

export const getStudentsByCourse = catchAsync(async (req: Request, res: Response) => {
  const { course } = req.params
  if (course) {
    const students = await studentService.getStudentsByCourseId(course, parseInt(req.query['page'] as string, 10) || 1)
    res.status(200).send({ students: students, message: "Students retrieved by course" })
  }
})

export const bulkAddStudents = catchAsync(async (req: Request, res: Response) => {
  const students = await studentService.bulkAddStudents(req.body.students)
  res.status(httpStatus.CREATED).send({ data: students, message: "students added" })
})

export const checkStudentInfo = catchAsync(async (req: Request, res: Response) => {
  const student = await studentService.findStudentByPhoneNumber(req.query['phoneNumber'] as string)
  res.status(httpStatus.OK).send({ data: student, message: "Student phone number resolved" })
})

export const registerStudent = catchAsync(async (req: Request, res: Response) => {
  const { email, phoneNumber, firstName, otherNames, custom, tz, teamId } = req.body
  const student = await studentService.registerStudent({ email, phoneNumber, firstName, otherNames, custom, tz })
  if (!student.verified) {
    // dispatch the event to send OTP for this user
    await studentService.sendOTP(student.id, student.phoneNumber, teamId)
  }
  res.status(httpStatus.CREATED).send({ data: student, message: "Student record has been created." })
})

// confirm OTP
export const confirmWhatsappOTP = catchAsync(async (req: Request, res: Response) => {
  const student = await studentService.verifyOTP(req.body.code, req.body.teamId)
  res.status(httpStatus.OK).send({ data: student, message: "Student phone number verified" })
})
// enroll for a course

export const enrollStudentToCourse = catchAsync(async (req: Request, res: Response) => {
  const { student } = req.params
  const { course, custom, cohortId } = req.body
  if (course && student) {
    await studentService.enrollStudentToCourse(student, course, "api", custom, cohortId)
  }
  res.status(200).send({ message: "Enrollment created" })
})


export const testCourseWhatsapp = catchAsync(async (req: Request, res: Response) => {
  const { course, phoneNumber, tz } = req.body
  if (course && phoneNumber && tz) {
    await studentService.testCourseWhatsapp(phoneNumber, course, tz)
  }
  res.status(200).send({ message: "Enrollment created" })
})


export const testCourseSlack = catchAsync(async (req: Request, res: Response) => {
  const { course, slackId } = req.body
  if (course && slackId) {
    await studentService.testCourseSlack(slackId, course)
  }
  res.status(200).send({ message: "Enrollment created" })
})

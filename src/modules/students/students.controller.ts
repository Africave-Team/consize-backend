import httpStatus from 'http-status'
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { studentService } from './'


export const bulkAddStudents = catchAsync(async (req: Request, res: Response) => {
  const students = await studentService.bulkAddStudents(req.body.students)
  res.status(httpStatus.CREATED).send({ data: students, message: "students added" })
})

export const checkStudentInfo = catchAsync(async (req: Request, res: Response) => {
  const student = await studentService.findStudentByPhoneNumber(req.query['phoneNumber'] as string)
  res.status(httpStatus.OK).send({ data: student, message: "Student phone number resolved" })
})

export const registerStudent = catchAsync(async (req: Request, res: Response) => {
  const { email, phoneNumber, firstName, otherNames, custom } = req.body
  const student = await studentService.registerStudent({ email, phoneNumber, firstName, otherNames, custom })
  if (!student.verified) {
    // dispatch the event to send OTP for this user
    await studentService.sendOTP(student.id, student.phoneNumber)
  }
  res.status(httpStatus.CREATED).send({ data: student, message: "Student record has been created." })
})

// confirm OTP
export const confirmWhatsappOTP = catchAsync(async (req: Request, res: Response) => {
  const student = await studentService.verifyOTP(req.body.code)
  res.status(httpStatus.OK).send({ data: student, message: "Student phone number verified" })
})
// enroll for a course

export const enrollStudentToCourse = catchAsync(async (req: Request, res: Response) => {
  const { student } = req.params
  const { course } = req.body
  if (course && student) {
    await studentService.enrollStudentToCourse(student, course)
  }
  res.status(200).send({ message: "Enrollment created" })
})
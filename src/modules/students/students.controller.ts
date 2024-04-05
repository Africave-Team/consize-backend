import httpStatus from 'http-status'
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { studentService } from './'

export const bulkAddStudents = catchAsync(async (req: Request, res: Response) => {
  const students = await studentService.bulkAddStudents(req.body.students)
  res.status(httpStatus.CREATED).send({ data: students, message: "students added" })
})

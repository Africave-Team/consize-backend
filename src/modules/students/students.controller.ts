import httpStatus from 'http-status'
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { studentService } from './'
// import Quizzes from '../courses/model.quizzes'
// import { QuestionTypes } from '../courses/interfaces.quizzes'

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
  //script to update question types
  // const quizzes = await Quizzes.find();
  // const normalizeText = (text:string) => text.trim().toLowerCase();

  // for (const quiz of quizzes) {
  //   const { choices } = quiz;
  //   let newQuestionType: QuestionTypes = quiz.questionType; // Default to current type

  //   if (choices.length === 3) {
  //     newQuestionType = QuestionTypes.OBJECTIVE;
  //   } else if (choices.length === 2) {
  //     const isMultiWord = choices.some(choice => choice.split(' ').length > 1);
  //     if (isMultiWord) {
  //       newQuestionType = QuestionTypes.OBJECTIVE;
  //     } else {
  //       const normalizedChoices = choices.map(normalizeText);

  //       if (normalizedChoices.includes("yes")) {
  //         newQuestionType = QuestionTypes.YES_NO;
  //       } else if (normalizedChoices.includes("true")) {
  //         newQuestionType = QuestionTypes.TRUE_FALSE;
  //       } else if (normalizedChoices.includes("agree")) {
  //         newQuestionType = QuestionTypes.POLARITY;
  //       }
  //     }
  //   }

  //   // Update questionType if it has changed
  //   if (quiz.questionType !== newQuestionType) {
  //     quiz.questionType = newQuestionType;
  //     await quiz.save();
  //     console.log(`Updated question: ${quiz._id}, new type: ${newQuestionType}`);
  //   }
  // }
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

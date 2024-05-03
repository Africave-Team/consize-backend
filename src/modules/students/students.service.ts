import httpStatus from 'http-status'
import ApiError from '../errors/ApiError'
import Students from './model.students'
import randomstring from "randomstring"
import { CreateStudentPayload, Student, StudentCourseStats, StudentInterface } from './interface.students'
import { agenda } from '../scheduler'
import { GENERATE_COURSE_TRENDS, SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { Message } from '../webhooks/interfaces.webhooks'
import OTP from './model.otp'
import db from "../rtdb"
import moment from 'moment'
import config from '../../config/config'
import { Course } from '../courses'
import { generateCourseFlow, sendWelcome, startCourse } from '../webhooks/service.webhooks'
import { LessonInterface } from '../courses/interfaces.lessons'
import { BlockInterface } from '../courses/interfaces.blocks'
import { COURSE_STATS } from '../rtdb/nodes'
import Teams from '../teams/model.teams'
import { QuizInterface } from '../courses/interfaces.quizzes'
import { sendWelcomeSlack, startCourseSlack } from '../slack/slack.services'
import Courses from '../courses/model.courses'

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


export const findStudentByPhoneNumber = async (phoneNumber: String): Promise<StudentInterface> => {
  const student = await Students.findOne({ phoneNumber })
  if (!student) {
    throw new ApiError(httpStatus.NOT_FOUND, "No student account found for this phone number.")
  }
  if (!student.verified) {
    await sendOTP(student.id, student.phoneNumber)
    throw new ApiError(httpStatus.BAD_REQUEST, "Student phone number has not been verified.")
  }
  return student
}

export const registerStudent = async (payload: CreateStudentPayload): Promise<StudentInterface> => {
  let student = await Students.findOne({ phoneNumber: payload.phoneNumber })
  if (!student) {
    student = await Students.create({
      ...payload
    })
  }
  return student
}


export const registerStudentSlack = async (payload: CreateStudentPayload): Promise<StudentInterface> => {
  let student = await Students.findOne({ slackId: payload.slackId })
  if (!student) {
    student = await Students.create({
      ...payload
    })
  }
  return student
}



// otps

export const sendOTP = async (userId: string, phoneNumber: string): Promise<void> => {
  const code = randomstring.generate({
    charset: 'numeric',
    length: 6
  })
  await OTP.findOneAndUpdate({ student: userId }, {
    expiration: moment().add(20, 'minutes').toDate(),
    code,
    student: userId
  }, { upsert: true })
  agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": phoneNumber,
    "type": "template",
    "template": {
      "language": { "code": "en_US" },
      "name": config.whatsapp.authTemplateName,
      "components": [
        {
          "type": "BODY",
          "parameters": [
            { "type": "text", "text": code },
          ],
        },
        {
          "type": "BUTTON",
          "sub_type": "url",
          "index": 0,
          "parameters": [
            { "type": "text", "text": code },
          ],
        },
      ],
    },

  })
}


export const verifyOTP = async (code: string): Promise<StudentInterface> => {
  const record = await OTP.findOne({ code })
  if (!record) {
    throw new ApiError(httpStatus.BAD_REQUEST, "This code is invalid. Check your messages and try again.")
  }
  if (moment().isAfter(moment(record.expiration))) {
    throw new ApiError(httpStatus.BAD_REQUEST, "This code has expired. Click resend to send it again.")
  }
  const student = await Students.findByIdAndUpdate(record.student, { verified: true }, { new: true })
  if (!student) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Could not complete this request. Try again later")
  }
  // send the success message

  agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": student.phoneNumber,
    "type": "template",
    "template": {
      "language": { "code": "en_US" },
      "name": "registration_successful"
    },
  })
  await record.deleteOne()
  return student

}



// course sessions
export const enrollStudentToCourse = async (studentId: string, courseId: string): Promise<void> => {
  const student = await Students.findOne({ _id: studentId })
  if (!student) {
    throw new ApiError(httpStatus.NOT_FOUND, "No student account found.")
  }
  if (!student.verified) {
    await sendOTP(student.id, student.phoneNumber)
    throw new ApiError(httpStatus.BAD_REQUEST, "Student phone number has not been verified.")
  }

  // enroll course
  const course = await Courses.findById(courseId)
  if (!course) {
    throw new ApiError(httpStatus.NOT_FOUND, "No course found for this id.")
  }
  const owner = await Teams.findById(course.owner).select('name')
  if (!owner) {
    throw new ApiError(httpStatus.NOT_FOUND, "No team found.")
  }
  await generateCourseFlow(courseId)
  await startCourse(student.phoneNumber, courseId, student.id)
  await sendWelcome(courseId, student.phoneNumber)

  let dbRef = db.ref(COURSE_STATS).child(course.owner).child(courseId)
  await dbRef.child("students").child(studentId).set({
    name: student.firstName + ' ' + student.otherNames,
    phoneNumber: student.phoneNumber,
    progress: 0,
    studentId,
    completed: false,
    droppedOut: false,
    scores: [],
    lessons: {}
  })

  const jobs = await agenda.jobs({ 'data.courseId': courseId })
  if (jobs.length === 0) {
    // Queue the trends generator
    agenda.every("15 minutes", GENERATE_COURSE_TRENDS, {
      courseId,
      teamId: course.owner
    })
  }

}

export const findStudentById = (studentId: string) => Students.findById(studentId)

export const saveBlockDuration = async function (teamId: string, studentId: string, duration: number, lesson?: LessonInterface, block?: BlockInterface) {
  const student = await Students.findById(studentId)
  if (lesson && block && student) {
    const dbRef = db.ref(COURSE_STATS).child(teamId).child(lesson.course).child("students").child(studentId)
    // get existing data
    const snapshot = await dbRef.once('value')

    // Step 3: Ensure the received data matches the defined type
    // Use type assertion or type guards to ensure type safety
    let data: StudentCourseStats | null = snapshot.val()
    if (data === null) {
      data = {
        name: `${student.firstName} ${student.otherNames}`,
        phoneNumber: student.phoneNumber,
        completed: false,
        studentId: student.id,
        progress: 0,
        droppedOut: false,
        scores: [],
        lessons: {
          [lesson.id]: {
            title: lesson.title,
            duration: 0,
            blocks: {
              [block.id]: {
                duration: 0
              }
            },
            quizzes: {}
          }
        }
      }
    }
    if (data && !data.lessons) {
      data.lessons = {}
    }
    if (data && !data.scores) {
      data.scores = []
    }
    if (data && data.lessons) {
      let lessonNode = data.lessons[lesson.id]
      if (!lessonNode) {
        data.lessons[lesson.id] = {
          title: lesson.title,
          duration: 0,
          blocks: {},
          quizzes: {}
        }
        lessonNode = data.lessons[lesson.id]
      }
      if (lessonNode) {
        if (!lessonNode.blocks) {
          lessonNode.blocks = {}
        }
        lessonNode.duration += duration
        const blockNode = lessonNode.blocks[block.id]
        if (blockNode) {
          blockNode.duration = duration
        } else {
          lessonNode.blocks[block.id] = {
            duration
          }
        }
      }
    }
    let payload: StudentCourseStats = {
      ...data,

    }
    dbRef.set(payload)
  }
}

export const completeCourse = async function (teamId: string, studentId: string, courseId: string, certificate: string) {
  const student = await Students.findById(studentId)
  if (student) {
    const dbRef = db.ref(COURSE_STATS).child(teamId).child(courseId).child("students").child(studentId)
    // get existing data
    const snapshot = await dbRef.once('value')

    // Step 3: Ensure the received data matches the defined type
    // Use type assertion or type guards to ensure type safety
    let data: StudentCourseStats | null = snapshot.val()
    if (data === null) {
      return
    }
    let payload: StudentCourseStats = {
      ...data,
      progress: 100,
      completed: true,
      certificate

    }
    dbRef.set(payload)
  }
}



export const saveCourseProgress = async function (teamId: string, studentId: string, courseId: string, progress: number) {
  const student = await Students.findById(studentId)
  if (student) {
    const dbRef = db.ref(COURSE_STATS).child(teamId).child(courseId).child("students").child(studentId)
    // get existing data
    const snapshot = await dbRef.once('value')

    // Step 3: Ensure the received data matches the defined type
    // Use type assertion or type guards to ensure type safety
    let data: StudentCourseStats | null = snapshot.val()
    if (data === null) {
      return
    }
    let payload: StudentCourseStats = {
      ...data,
      progress

    }
    dbRef.set(payload)
  }
}


export const saveQuizDuration = async function (teamId: string, studentId: string, duration: number, score: number, attempts: number, lesson?: LessonInterface, quiz?: QuizInterface) {
  const student = await Students.findById(studentId)
  if (lesson && quiz && student) {
    const dbRef = db.ref(COURSE_STATS).child(teamId).child(lesson.course).child("students").child(studentId)
    // get existing data
    const snapshot = await dbRef.once('value')

    // Step 3: Ensure the received data matches the defined type
    // Use type assertion or type guards to ensure type safety
    let data: StudentCourseStats | null = snapshot.val()
    if (data === null) {
      data = {
        name: `${student.firstName} ${student.otherNames}`,
        phoneNumber: student.phoneNumber,
        studentId,
        completed: false,
        droppedOut: false,
        progress: 0,
        scores: [],
        lessons: {
          [lesson.id]: {
            title: lesson.title,
            duration: 0,
            blocks: {},
            quizzes: {
              [quiz.id]: {
                duration: 0,
                retakes: 0,
                score: 0
              }
            }
          }
        }
      }
    }
    if (data && !data.scores) {
      data.scores = []
    }
    if (data && data.scores && Array.isArray(data.scores)) {
      data.scores.push(score)
    }
    if (data && !data.lessons) {
      data.lessons = {}
    }
    if (data && data.lessons) {
      let lessonNode = data.lessons[lesson.id]
      if (!lessonNode) {
        data.lessons[lesson.id] = {
          title: lesson.title,
          duration: 0,
          blocks: {},
          quizzes: {}
        }
        lessonNode = data.lessons[lesson.id]
      }
      if (lessonNode) {
        if (!lessonNode.quizzes) {
          lessonNode.quizzes = {}
        }
        lessonNode.duration += duration
        const quizNode = lessonNode.quizzes[quiz.id]
        if (quizNode) {
          quizNode.duration = duration
          quizNode.retakes = attempts
        } else {
          lessonNode.quizzes[quiz.id] = {
            duration,
            retakes: attempts,
            score
          }
        }
      }
    }
    let payload: StudentCourseStats = {
      ...data,

    }
    dbRef.set(payload)
  }
}

export const testCourseSlack = async (slackId: string, courseId: string): Promise<void> => {

  // enroll course
  const course = await Course.findById(courseId)
  if (!course) {
    throw new ApiError(httpStatus.NOT_FOUND, "No course found for this id.")
  }
  const owner = await Teams.findById(course.owner).select('name')
  if (!owner) {
    throw new ApiError(httpStatus.NOT_FOUND, "No team found.")
  }
  if (owner.slackToken) {
    await generateCourseFlow(courseId)
    const id = await startCourseSlack(slackId, courseId, slackId, owner.slackToken)
    await sendWelcomeSlack(courseId, slackId, owner.slackToken, id)
  }

}

export const testCourseWhatsapp = async (phoneNumber: string, courseId: string): Promise<void> => {
  // enroll course
  const course = await Course.findById(courseId)
  if (!course) {
    throw new ApiError(httpStatus.NOT_FOUND, "No course found for this id.")
  }
  const owner = await Teams.findById(course.owner).select('name')
  if (!owner) {
    throw new ApiError(httpStatus.NOT_FOUND, "No team found.")
  }
  await generateCourseFlow(courseId)
  await startCourse(phoneNumber, courseId, phoneNumber)
  await sendWelcome(courseId, phoneNumber)

}
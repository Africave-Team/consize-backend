import httpStatus from 'http-status'
import ApiError from '../errors/ApiError'
import Students from './model.students'
import Enrollments from '../sessions/model'
import randomstring from "randomstring"
import { CreateStudentPayload, Student, StudentCourseStats, StudentInterface } from './interface.students'
import { agenda } from '../scheduler'
import { GENERATE_COURSE_TRENDS, SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { Message, ReplyButton } from '../webhooks/interfaces.webhooks'
import OTP from './model.otp'
import db from "../rtdb"
import moment from 'moment-timezone'
import config from '../../config/config'
import { generateCourseFlow, sendWelcome, startBundle, startCourse } from '../webhooks/service.webhooks'
import { LessonInterface } from '../courses/interfaces.lessons'
import { BlockInterface } from '../courses/interfaces.blocks'
import { COURSE_STATS } from '../rtdb/nodes'
import Teams from '../teams/model.teams'
import { QuizInterface } from '../courses/interfaces.quizzes'
import { sendWelcomeSlack, startCourseSlack } from '../slack/slack.services'
import Courses from '../courses/model.courses'
import Settings from '../courses/model.settings'
import { subscriptionService } from '../subscriptions'
import { sessionService } from '../sessions'
import { MAX_FREE_PLAN_MONTHLY_ENROLLMENTS } from '../../config/constants'
import { statsService } from '../statistics'
import { Cohorts } from '../cohorts'
import { Distribution } from '../courses/interfaces.courses'
import Assessment from '../statistics/assessment.model'

export const bulkAddStudents = async (students: Student[]): Promise<string[]> => {
  try {
    const studentIds: string[] = []
    for (let student of students) {
      let result = await Students.findOne({ phoneNumber: student.phoneNumber })
      if (result) {
        if (!result.verified) {
          result.verified = true
          await result.save()
        }
        studentIds.push(result.id)
      } else {
        result = await Students.create({ ...student, verified: true })
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
  console.log(code)
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
export const enrollStudentToCourse = async (studentId: string, courseId: string, source: "api" | "qr", customData?: any, cohortId?: string): Promise<void> => {
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
  // get active subscription
  const subscription = await subscriptionService.fetchMyActiveSubscription(course.owner)
  if (!subscription) {
    // send subscription plan cap message
    if (source === "qr") {
      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
        to: student.phoneNumber,
        type: "text",
        messaging_product: "whatsapp",
        recipient_type: "individual",
        text: {
          body: `The organization who owns this course, *${owner.name}*, have exceeded the maximum enrollments for their subscription plan`
        }
      })
      return
    } else {
      throw new ApiError(httpStatus.BAD_REQUEST, `The organization who owns this course, *${owner.name}*, have exceeded the maximum enrollments for their subscription plan`)
    }
  }
  const plan = await subscriptionService.fetchSubscriptionPlanById(subscription.plan as string)
  if (!plan) {
    // send subscription plan cap message
    if (source === "qr") {
      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
        to: student.phoneNumber,
        team: course.owner,
        type: "text",
        messaging_product: "whatsapp",
        recipient_type: "individual",
        text: {
          body: `The organization who owns this course, *${owner.name}*, have exceeded the maximum enrollments for their subscription plan`
        }
      })
      return
    } else {
      throw new ApiError(httpStatus.BAD_REQUEST, `The organization who owns this course, *${owner.name}*, have exceeded the maximum enrollments for their subscription plan`)
    }
  }
  if (plan.price === 0) {
    // free plan
    // get all the team's enrollments
    const today = new Date()
    const teamEnrollmentCount = await sessionService.countTeamEnrollmentsPerMonth(course.owner, today.getMonth(), today.getFullYear())
    if ((teamEnrollmentCount + 1) > MAX_FREE_PLAN_MONTHLY_ENROLLMENTS) {
      // send subscription plan cap message
      if (source === "qr") {
        agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
          to: student.phoneNumber,
          type: "text",
          team: course.owner,
          messaging_product: "whatsapp",
          recipient_type: "individual",
          text: {
            body: `The organization who owns this course, *${owner.name}*, have exceeded the maximum enrollments for their subscription plan`
          }
        })
        return
      } else {
        throw new ApiError(httpStatus.BAD_REQUEST, `The organization who owns this course, *${owner.name}*, have exceeded the maximum enrollments for their subscription plan`)
      }
    }
  }
  const settings = await Settings.findById(course.settings)

  if (settings) {
    if (source === "qr") {
      const buttons: ReplyButton[] = []
      let message = `Hello ${student.firstName}! Thank you for enrolling on the course *${course.title.trim()}*\nPlease select when you would like to start this course.\n\n`
      let options = ['A', 'B', 'C']
      if (settings.resumption) {
        if (settings.resumption.enableImmediate) {
          let index = buttons.length
          buttons.push({
            type: "reply",
            reply: {
              id: `enroll_now_${courseId}`,
              title: `${options[index]}. Start now`
            }
          })
          message = `${message}If you choose option *${options[index]}*, you start the course immediately\n\n`
        }

        if (settings.resumption.days !== null && settings.resumption.time !== null) {
          let index = buttons.length
          // calculate the 
          let date = moment().add(settings.resumption.days, 'days')
          let day = date.format('dddd, Do of MMMM, YYYY')
          buttons.push({
            type: "reply",
            reply: {
              id: `enroll_default_time_${courseId}`,
              title: `${options[index]}. Use default time`
            }
          })
          const [h, m] = settings.resumption.time.split(':')
          let hours = Number(h), minutes = Number(m)
          message = `${message}If you choose option *${options[index]}*, your course starts at a time set by the course creator, i.e. ${date.hour(hours).minute(minutes).format('h:mmA')} on ${day}\n\n`
        }

        if (settings.resumption.enabledDateTimeSetup) {
          let index = buttons.length
          buttons.push({
            type: "reply",
            reply: {
              id: `choose_enroll_time_${courseId}`,
              title: `${options[index]}. Choose your time`
            }
          })
          message = `${message}If you choose option *${options[index]}*, you may choose your own time\n`
        }
      } else {
        message = `${message}If you choose option A, your course starts immediately.\n\nIf you choose option B, you may choose when you want to start the course.`
        buttons.push({
          type: "reply",
          reply: {
            id: `enroll_now_${courseId}`,
            title: "A. Start now"
          }
        }, {
          type: "reply",
          reply: {
            id: `choose_enroll_time_${courseId}`,
            title: "B. Choose your time"
          }
        },)
      }
      // send the extra message
      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
        to: student.phoneNumber,
        type: "interactive",
        team: course.owner,
        messaging_product: "whatsapp",
        recipient_type: "individual",
        interactive: {
          body: {
            text: message
          },
          type: "button",
          action: {
            buttons
          }
        }
      })
    } else {
      startEnrollmentWhatsapp(studentId, courseId, source, customData, cohortId)
    }
  } else {
    startEnrollmentWhatsapp(studentId, courseId, source, customData, cohortId)
  }

}

export const startEnrollmentWhatsapp = async function (studentId: string, courseId: string, source: "api" | "qr", customData?: any, cohortId?: string): Promise<void> {
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

  if (source === "qr") {
    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
      to: student.phoneNumber,
      team: course.owner,
      type: "text",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      text: {
        body: `Hello ${student.firstName}! Your enrollment to the course *${course.title.trim()}* has started 🎉\n\nYou shall receive the course in the next 10 seconds ⏰`
      }
    })
  }

  if (!course.bundle) {
    await generateCourseFlow(courseId)
    await startCourse(student.phoneNumber, courseId, student.id)
    await sendWelcome(student.phoneNumber, course.owner)

  } else {
    const courses = course.courses
    if (courses.length > 0) {
      const courseFlowPromises = courses.map((id: string) => generateCourseFlow(id))

      await Promise.all(courseFlowPromises)

      await startBundle(student.phoneNumber, courseId, student.id)
      await sendWelcome(student.phoneNumber, course.owner)

    } else {
      throw new ApiError(httpStatus.NOT_FOUND, "No course in this course bundle, please add course")
    }
  }
  let dbRef = db.ref(COURSE_STATS).child(course.owner).child(courseId)

  if (!cohortId) {
    let cohort
    if (source === "api") {
      cohort = await Cohorts.findOne({ name: "Website", global: true })
    } else {
      cohort = await Cohorts.findOne({ name: "QR Code", global: true })
    }

    if (cohort) {
      cohortId = cohort.id
    }
  }

  await dbRef.child("students").child(studentId).set({
    name: student.firstName + ' ' + student.otherNames,
    phoneNumber: student.phoneNumber,
    distribution: Distribution.WHATSAPP,
    cohortId: cohortId || "",
    dateEnrolled: moment().format('MM-DD-YYYY'),
    progress: 0,
    studentId,
    completed: false,
    droppedOut: false,
    scores: [],
    lessons: {}
  })

  await sessionService.createEnrollment({
    courseId,
    anonymous: student.anonymous,
    teamId: course.owner,
    distribution: Distribution.WHATSAPP,
    name: student.firstName + ' ' + student.otherNames,
    phoneNumber: student.phoneNumber,
    progress: 0,
    studentId,
    completed: false,
    droppedOut: false,
    scores: [],
    lessons: {},
    custom: customData || {},
    cohortId: cohortId || ""
  })

  const jobs = await agenda.jobs({ 'data.courseId': courseId, name: GENERATE_COURSE_TRENDS })
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
        anonymous: student.anonymous,
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
    await dbRef.set(payload)
    await sessionService.updateEnrollment(studentId, lesson.course, payload)
    await statsService.updateDailyStats({
      baselineScore: 0,
      endlineScore: 0,
      blockDuration: duration,
      completionTime: 0,
      courseId: lesson.course,
      lessonDuration: 0,
      progress: 0,
      retakeRate: 0,
      studentId: student.id,
      teamId: teamId,
      testScore: 0
    })
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
    await dbRef.set(payload)
    await sessionService.updateEnrollment(studentId, courseId, payload)
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
    await dbRef.set(payload)
    await sessionService.updateEnrollment(studentId, courseId, payload)
  }
}


export const saveQuizDuration = async function (teamId: string, studentId: string, courseId: string, duration: number, score: number, attempts: number, lesson?: LessonInterface, quiz?: QuizInterface) {
  const student = await Students.findById(studentId)
  if (lesson && quiz && student) {
    const dbRef = db.ref(COURSE_STATS).child(teamId).child(courseId).child("students").child(studentId)
    // get existing data
    const snapshot = await dbRef.once('value')

    // Step 3: Ensure the received data matches the defined type
    // Use type assertion or type guards to ensure type safety
    let data: StudentCourseStats | null = snapshot.val()
    if (data === null) {
      data = {
        name: `${student.firstName} ${student.otherNames}`,
        phoneNumber: student.phoneNumber,
        anonymous: student.anonymous,
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
    await dbRef.set(payload)
    await sessionService.updateEnrollment(studentId, lesson.course, payload)
  }
}

export const testCourseSlack = async (slackId: string, courseId: string): Promise<void> => {

  // enroll course
  const course = await Courses.findById(courseId)
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

export const testCourseWhatsapp = async (phoneNumber: string, courseId: string, tz: string): Promise<void> => {
  // enroll course
  const course = await Courses.findById(courseId)
  if (!course) {
    throw new ApiError(httpStatus.NOT_FOUND, "No course found for this id.")
  }
  const owner = await Teams.findById(course.owner).select('name')
  if (!owner) {
    throw new ApiError(httpStatus.NOT_FOUND, "No team found.")
  }
  // check if the student exists
  let student = await Students.findOne({ phoneNumber })
  if (!student) {
    student = await Students.create({
      firstName: "Anonymous",
      otherNames: "Student",
      anonymous: true,
      verified: true,
      tz,
      phoneNumber
    })
  }
  await generateCourseFlow(courseId)
  await startCourse(phoneNumber, courseId, student.id)
  await sendWelcome(phoneNumber, course.owner)

}

export const getAllStudents = async (teamId: string, page: number = 1): Promise<any> => {
  const studentIds = await Enrollments.distinct('studentId', { teamId })

  const students = await Students.paginate({ _id: { $in: studentIds } }, { sortBy: 'createdAt:desc', page, limit: 10 })

  if (!students) {
    throw new ApiError(httpStatus.NOT_FOUND, "team does not have any enrolled students")
  }
  return students
}

export const getStudentsByCourseId = async (courseId: string, page: number = 1): Promise<any> => {
  const studentIds = await Enrollments.distinct('studentId', { courseId })

  const students = await Students.paginate({ _id: { $in: studentIds } }, { sortBy: 'createdAt:desc', page, limit: 10 })
  if (!students) {
    throw new ApiError(httpStatus.NOT_FOUND, "course does not have any enrolled students")
  }
  return students
}

export const saveAssessmentScore = async (teamId: string, courseId: string, studentId: string, assessmentId: string, score: number): Promise<void> => {
  // Find the record with courseId, assessmentId, and studentId
  await Assessment.findOneAndUpdate(
    { courseId, assessmentId, studentId, teamId },
    { $set: { score } }, // Update the score if found
    { new: true, upsert: true } // Create a new record if not found
  )
}

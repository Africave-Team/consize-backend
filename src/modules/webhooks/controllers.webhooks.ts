import httpStatus from 'http-status'
import he from "he"
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { agenda } from '../scheduler'
import { ENROLL_STUDENT_DEFAULT_DATE, RESUME_TOMORROW, SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { CONTINUE, QUIZA_A, QUIZA_B, QUIZA_C, QUIZ_A, QUIZ_B, QUIZ_C, QUIZ_NO, QUIZ_YES, Message, CERTIFICATES, COURSES, STATS, START, CourseEnrollment, SURVEY_A, SURVEY_B, SURVEY_C, TOMORROW, SCHEDULE_RESUMPTION, MORNING, AFTERNOON, EVENING, RESUME_COURSE, InteractiveMessageSectionRow, RESUME_COURSE_TOMORROW } from './interfaces.webhooks'
import { convertToWhatsAppString, exchangeFacebookToken, fetchEnrollments, handleBlockQuiz, handleContinue, handleLessonQuiz, handleAssessment, handleSurveyFreeform, handleSurveyMulti, scheduleInactivityMessage, sendResumptionOptions, sendScheduleAcknowledgement, reloadTemplates } from "./service.webhooks"
import config from '../../config/config'
import { redisClient } from '../redis'
import { v4 } from 'uuid'
import Blocks from '../courses/model.blocks'
import moment from 'moment-timezone'
import { maxEnrollmentReached, resolveCourseWithShortcode, resolveTeamCourseWithShortcode } from '../courses/service.courses'
import { studentService } from '../students'
import Students from '../students/model.students'
import Courses from '../courses/model.courses'
import { courseService } from '../courses'
import { teamService } from '../teams'
import { resolveCohortWithShortCode } from '../cohorts/service.cohorts'
// import { logger } from '../logger'

const timezones = [
  {
    "name": "Eastern Time (ET)",
    "timezone": "America/New_York"
  },
  {
    "name": "Central Time (CT)",
    "timezone": "America/Chicago"
  },
  {
    "name": "Mountain Time (MT)",
    "timezone": "America/Denver"
  },
  {
    "name": "Pacific Time (PT)",
    "timezone": "America/Los_Angeles"
  },
  {
    "name": "GMT (Greenwich Mean Time)",
    "timezone": "GMT"
  },
  {
    "name": "CET (Central European Time)",
    "timezone": "Europe/Paris"
  },
  {
    "name": "EET (Eastern European Time)",
    "timezone": "Europe/Istanbul"
  },
  {
    "name": "WAT (West Africa Time)",
    "timezone": "Africa/Lagos"
  },
  {
    "name": "CAT (Central Africa Time)",
    "timezone": "Africa/Johannesburg"
  },
  {
    "name": "EAT (East Africa Time)",
    "timezone": "Africa/Nairobi"
  }
]

export const getMomentTomorrow = (time: number) => {
  const currentTime = moment()

  // Get tomorrow's date
  const tomorrowDate = moment().add(1, 'day').startOf('day')

  // Combine tomorrow's date with 3 PM time
  const targetTime = tomorrowDate.set('hour', time).set('minute', 0).set('second', 0)
  const durationDifference = moment.duration(targetTime.diff(currentTime))

  // Format the duration as "in X hours, Y minutes"
  const formattedDuration = `${durationDifference.hours()} hours, ${durationDifference.minutes()} minutes, ${durationDifference.seconds()} seconds`

  // Calculate the difference in hours
  return formattedDuration
}

export function convertTo12HourFormat (time: string) {
  const [hours, minutes] = time.split(':')
  if (hours && minutes) {
    const period = Number(hours) >= 12 ? 'PM' : 'AM'
    const adjustedHours = Number(hours) % 12 || 12
    return `${adjustedHours}:${minutes} ${period}`
  }
  return null
}

export const whatsappWebhookSubscriber = catchAsync(async (req: Request, res: Response) => {
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == config.whatsappSubscriptionKey
  ) {
    res.send(req.query['hub.challenge'])
  } else {
    res.sendStatus(400)
  }
})

export const whatsappWebhookMessageHandler = catchAsync(async (req: Request, res: Response) => {
  const reqBody = req.body.entry[0].changes[0]
  console.log(JSON.stringify(reqBody.value.statuses))
  if (reqBody.field !== "messages") {
    return res.status(400)
  }
  const messageBody = reqBody.value.messages
  if (messageBody) {
    const destination = messageBody[0].from
    const type = messageBody[0].type
    let enrollments: CourseEnrollment[] = await fetchEnrollments(destination)
    let enrollment: CourseEnrollment | undefined = enrollments.find(e => e.active)
    console.log(type)
    if (type === "interactive") {

      const interactive = messageBody[0].interactive
      if (interactive.type === "button_reply") {
        const response = interactive.button_reply.id
        const [btnId, messageId] = response.split('|')
        console.log("message id", messageId, btnId)
        // if (messageId && btnId !== CONTINUE && btnId !== RESUME_COURSE && btnId !== START) {
        //   if (enrollment) {
        //     if (enrollment.lastMessageId && enrollment.lastMessageId !== messageId) {
        //       console.log("invalid message id")
        //       return res.send()
        //     }
        //   }
        // }
        let today = moment().add(24, 'hours').format('YYYY-MM-DD')
        switch (btnId) {
          case START:
          case RESUME_COURSE:
          case RESUME_COURSE_TOMORROW:
          case CONTINUE:
            if (enrollment) {
              let msgId = v4()
              let key = `${config.redisBaseKey}courses:${enrollment.id}`
              await handleContinue(enrollment.nextBlock, key, destination, msgId, enrollment)
              // schedule inactivity message
              scheduleInactivityMessage(enrollment, destination)
            }
            break
          case QUIZ_NO:
          case QUIZ_YES:
            let answer = "yes"
            if (btnId === QUIZ_NO) {
              answer = "no"
            }
            if (enrollment) {
              const msgId = v4()
              handleBlockQuiz(answer, enrollment, destination, msgId)
              // schedule inactivity message
              scheduleInactivityMessage(enrollment, destination)
            }
            break
          case QUIZ_A:
          case QUIZ_B:
          case QUIZ_C:
            let answerResponse = 0
            if (btnId === QUIZ_B) answerResponse = 1
            if (btnId === QUIZ_C) answerResponse = 2
            if (enrollment) {
              const msgId = v4()
              console.log(enrollment)
              await handleLessonQuiz(answerResponse, enrollment, destination, msgId)
              // schedule inactivity message
              scheduleInactivityMessage(enrollment, destination)
            }
            break
          case QUIZA_A:
          case QUIZA_B:
          case QUIZA_C:
            let choice = 0
            if (btnId === QUIZA_B) choice = 1
            if (btnId === QUIZA_C) choice = 2
            if (enrollment) {
              const msgId = v4()
              console.log(enrollment)
              await handleAssessment(choice, enrollment, destination, msgId)
              // schedule inactivity message
              scheduleInactivityMessage(enrollment, destination)
            }
            break
          case STATS:

            break
          case COURSES:
            if (enrollments.length === 0) {
              agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                to: destination,
                type: "text",
                messaging_product: "whatsapp",
                recipient_type: "individual",
                text: {
                  body: "You do not have any ongoing courses."
                }
              })
            } else {
              if (enrollment && enrollment.team) {
                const team = await teamService.fetchTeamById(enrollment.team)
                let list = enrollments
                if (team && team.facebookData) {
                  list = enrollments.filter(e => e.team === team.id)
                }

                for (let data of list) {
                  let progress = (data.nextBlock / data.totalBlocks) * 100
                  if (progress < 100) {
                    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                      to: destination,
                      team: data.team,
                      type: "interactive",
                      messaging_product: "whatsapp",
                      recipient_type: "individual",
                      interactive: {
                        body: {
                          text: `*${data.title}*\n\n${data.description}\n\n*Progress*: ${progress.toFixed(0)}%`
                        },
                        type: "button",
                        action: {
                          buttons: [
                            {
                              type: "reply",
                              reply: {
                                id: `continue_${data.id}`,
                                title: "Continue"
                              }
                            }
                          ]
                        }
                      }
                    })
                  }
                }
              }
            }
            break
          case CERTIFICATES:

            break
          case SURVEY_A:
          case SURVEY_B:
          case SURVEY_C:
            console.log("Here survey")
            let rsp = 0
            if (btnId === SURVEY_B) rsp = 1
            if (btnId === SURVEY_C) rsp = 2
            if (enrollment) {
              console.log("Here survey", enrollment)
              const msgId = v4()
              await handleSurveyMulti(rsp, enrollment, destination, msgId)
              // schedule inactivity message
              scheduleInactivityMessage(enrollment, destination)
            }
            break
          case TOMORROW:
          case MORNING:
            if (enrollment) {
              let msgId = v4()
              const dateTimeString = `${today} 09:00` // Note: removed 'PM'
              const now = moment.tz(enrollment.tz)
              const time = moment(dateTimeString).subtract(now.utcOffset(), 'minutes')
              agenda.schedule(time.toDate(), RESUME_TOMORROW, { messageId: msgId, enrollment, phoneNumber: destination })
              sendScheduleAcknowledgement(destination, "9:00am", enrollment.team)
            }
            break
          case AFTERNOON:
            if (enrollment) {
              let msgId = v4()
              const dateTimeString = `${today} 15:00` // Note: removed 'PM'
              const now = moment.tz(enrollment.tz)
              const time = moment(dateTimeString).subtract(now.utcOffset(), 'minutes')
              agenda.schedule(time.toDate(), RESUME_TOMORROW, { messageId: msgId, enrollment, phoneNumber: destination })
              sendScheduleAcknowledgement(destination, "3:00pm", enrollment.team)
            }
            break
          case EVENING:
            if (enrollment) {
              let msgId = v4()
              const dateTimeString = `${today} 20:00` // Note: removed 'PM'
              const now = moment.tz(enrollment.tz)
              const time = moment(dateTimeString).subtract(now.utcOffset(), 'minutes')
              agenda.schedule(time.toDate(), RESUME_TOMORROW, { messageId: msgId, enrollment, phoneNumber: destination })
              sendScheduleAcknowledgement(destination, "8:00pm", enrollment.team)
            }
            break
          case SCHEDULE_RESUMPTION:
            if (enrollment) {
              const key = `${config.redisBaseKey}enrollments:${destination}:${enrollment.id}`
              sendResumptionOptions(destination, key, enrollment)
              // schedule inactivity message
              scheduleInactivityMessage(enrollment, destination)
            }
            break
          default:
            if (btnId.startsWith('continue_')) {
              const courseId = btnId.replace("continue_", "")
              // continue a course from the positions message
              const enrollments: CourseEnrollment[] = await fetchEnrollments(destination)
              await Promise.all(enrollments.map(async (enrollment) => {
                const key = `${config.redisBaseKey}enrollments:${destination}:${enrollment.id}`
                let msgId = v4()
                enrollment.active = enrollment.id === courseId
                await redisClient.set(key, JSON.stringify({ ...enrollment, active: enrollment.id === courseId }))
                if (enrollment.id === courseId) {
                  await handleContinue(enrollment.currentBlock, `${config.redisBaseKey}courses:${enrollment.id}`, destination, msgId, { ...enrollment, currentBlock: enrollment.currentBlock - 1, nextBlock: enrollment.currentBlock })
                }

              }))
            }

            if (btnId.startsWith('enroll_now_')) {
              const courseId = btnId.replace("enroll_now_", "")
              // continue a course from the positions message
              const student = await studentService.findStudentByPhoneNumber(destination)
              if (student) {
                studentService.startEnrollmentWhatsapp(student.id, courseId, "qr")
              }
            }
            if (btnId.startsWith('enroll_default_time_')) {
              const courseId = btnId.replace("enroll_default_time_", "")
              // continue a course from the positions message
              const student = await studentService.findStudentByPhoneNumber(destination)
              if (student) {
                const course = await courseService.fetchSingleCourse({ courseId })
                if (course) {
                  let settings = await courseService.fetchSingleSettings(course.settings)
                  if (settings && settings.resumption) {
                    let date = moment().add(settings.resumption.days, 'days')
                    let day = date.format('dddd, Do of MMMM, YYYY')
                    const now = moment.tz(student.tz)
                    const [h, m] = settings.resumption.time.split(':')
                    let hours = Number(h), minutes = Number(m)
                    let dayFormatted = moment().add(settings.resumption.days, 'days').format('YYYY-MM-DD')
                    const time = moment(`${dayFormatted}`).hour(hours).minute(minutes).subtract(now.utcOffset(), 'minutes')
                    agenda.schedule<{ studentId: string, courseId: string }>(time.toDate(), ENROLL_STUDENT_DEFAULT_DATE, { courseId, studentId: student.id })
                    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                      to: student.phoneNumber,
                      type: "text",
                      messaging_product: "whatsapp",
                      recipient_type: "individual",
                      text: {
                        body: `Thank you. You have scheduled to start the course *${course.title.trim()}* by ${date.hour(hours).minute(minutes).format('h:mmA')} on ${day}.\n\n We will begin sending you this course content on the above date and time.`
                      }
                    })
                  }
                }
              }
            }
            if (btnId.startsWith('choose_enroll_time_')) {
              const courseId = btnId.replace("choose_enroll_time_", "")
              // continue a course from the positions message
              const student = await studentService.findStudentByPhoneNumber(destination)
              if (student) {
                const dates: InteractiveMessageSectionRow[] = []

                for (let index = 0; index < 7; index++) {
                  let item: InteractiveMessageSectionRow = {
                    id: "", title: "", description: ""
                  }
                  let day = moment().add(index, 'days')
                  let date = day.format('ddd, Do of MMM, YYYY')
                  if (index === 0) {
                    item.title = "Start today"
                  } else if (index === 1) {
                    item.title = 'Start tomorrow'
                  } else {
                    item.title = `${date}`
                  }
                  item.id = `resumption_date~${courseId}|${day.format('YYYY-MM-DD')}`
                  dates.push(item)
                }
                console.log(dates)
                agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                  to: student.phoneNumber,
                  type: "interactive",
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  interactive: {
                    body: {
                      text: "Please select your convenient date"
                    },
                    type: "list",
                    action: {
                      button: "Select a date",
                      sections: [
                        {
                          title: "Select a convenient date",
                          rows: dates
                        }
                      ]
                    }
                  }
                })
              }
            }
            break
        }
      }

      if (interactive.type === "list_reply") {
        try {
          const [action, values] = interactive.list_reply.id.split('~')
          console.log(action)
          switch (action) {
            case "resumption_time":
              const [courseId, value1, value2] = values.split('|')
              console.log(courseId, value1, value2)
              // continue a course from the positions message
              const student = await studentService.findStudentByPhoneNumber(destination)
              if (student) {
                const course = await courseService.fetchSingleCourse({ courseId })
                if (course) {
                  let date = moment(value1)
                  let day = date.format('dddd, Do of MMMM, YYYY')
                  const now = moment.tz(student.tz)
                  let dayFormatted = moment(value1).format('YYYY-MM-DD')
                  const time = moment(`${dayFormatted} ${value2}`).subtract(now.utcOffset(), 'minutes')
                  agenda.schedule<{ studentId: string, courseId: string }>(time.toDate(), ENROLL_STUDENT_DEFAULT_DATE, { courseId, studentId: student.id })

                  agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                    to: student.phoneNumber,
                    type: "text",
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    text: {
                      body: `Thank you. You have scheduled to start the course *${course.title.trim()}* by ${date.hour(Number(value2.replace(':00', ''))).format('hA')} on ${day}.\n\n We will begin sending you this course content on the above date and time.`
                    }
                  })
                }
              }
              break
            case "resumption_date":
              try {
                const [courseId, value1] = values.split('|')
                if (value1) {
                  const student = await studentService.findStudentByPhoneNumber(destination)
                  if (student) {
                    let dateValue = moment(value1)
                    let times: InteractiveMessageSectionRow[] = []
                    let start = 8
                    if (dateValue.isSame(moment(), 'day')) {
                      const currentTime = moment.tz(student.tz)

                      // Get the current hour
                      const currentHour = currentTime.hour()

                      // Calculate the next even hour
                      const nextEvenHour = currentHour % 2 === 0 ? currentHour + 2 : currentHour + 1
                      start = nextEvenHour
                    }
                    let isToday = dateValue.isSame(moment(), 'day')
                    let isTomorrow = dateValue.isSame(moment().add(1), 'day')
                    for (let index = start; index <= 20; index += 2) {
                      times.push({
                        id: `resumption_time~${courseId}|${value1}|${moment().hour(index).minute(0).second(0).format('HH:mm')}`,
                        title: `${moment().hour(index).minute(0).second(0).format('hA')} ${isToday ? 'today' : isTomorrow ? 'tomorrow' : `on ${dateValue.format('Do MMM, YYYY')}`}`,
                        description: ""
                      })
                    }
                    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                      to: destination,
                      type: "interactive",
                      messaging_product: "whatsapp",
                      recipient_type: "individual",
                      interactive: {
                        body: {
                          text: "Select a convenient time to start your course"
                        },
                        type: "list",
                        action: {
                          button: "Select a time",
                          sections: [
                            {
                              title: "Select time to start.",
                              rows: times
                            }
                          ]
                        }
                      }
                    })
                  }

                }
              } catch (error) {
                console.log(error)
              }
              break

            default:
              break
          }
        } catch (error) {
          console.log(error)
        }
      }

    } else if (type === "text") {
      const fieldKey = `${config.redisBaseKey}field:${destination}`
      const fieldsKey = `${config.redisBaseKey}fields:${destination}`
      const keySelected = `${config.redisBaseKey}selected:${destination}`
      const keyLastRequest = `${config.redisBaseKey}last_request:${destination}`
      const response = messageBody[0].text.body.toLowerCase()
      let field: string | null
      let fieldsRaw: string | null
      switch (response) {
        case "/sos":
          if (enrollment) {
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: destination,
              team: enrollment.team,
              type: "interactive",
              messaging_product: "whatsapp",
              recipient_type: "individual",
              interactive: {
                body: {
                  text: "Use any one of these options to recover your history"
                },
                type: "button",
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: COURSES,
                        title: "My courses"
                      }
                    },
                    {
                      type: "reply",
                      reply: {
                        id: STATS,
                        title: "My stats"
                      }
                    },
                    {
                      type: "reply",
                      reply: {
                        id: CERTIFICATES,
                        title: "My certificates"
                      }
                    }
                  ]
                }
              }
            })
          } else {
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: destination,
              type: "interactive",
              messaging_product: "whatsapp",
              recipient_type: "individual",
              interactive: {
                body: {
                  text: "Use any one of these options to recover your history"
                },
                type: "button",
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: COURSES,
                        title: "My courses"
                      }
                    },
                    {
                      type: "reply",
                      reply: {
                        id: STATS,
                        title: "My stats"
                      }
                    },
                    {
                      type: "reply",
                      reply: {
                        id: CERTIFICATES,
                        title: "My certificates"
                      }
                    }
                  ]
                }
              }
            })
          }
          break
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
        case "10":
          field = await redisClient.get(fieldKey)
          const dt = await redisClient.get(keyLastRequest)
          console.log(field, dt, enrollment)
          if (field && field === "tz") {
            let selected = timezones[Number(response) - 1]
            if (selected) {
              await Students.updateOne({ phoneNumber: destination }, { $set: { tz: selected.timezone, verified: true } })
              const student = await Students.findOne({ phoneNumber: destination })
              // 
              let courseId = await redisClient.get(keySelected)
              const course = await Courses.findById(courseId)
              if (courseId && course && student) {
                agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                  to: destination,
                  type: "text",
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  text: {
                    body: `Thank you for your message! Your enrollment to the course *${course.title.trim()}* has started 🎉\n\nYou shall receive the course in the next 10 seconds ⏰`
                  }
                })
                await studentService.enrollStudentToCourse(student.id, courseId, "qr")
                redisClient.del(fieldKey)
                redisClient.del(fieldsKey)
                redisClient.del(keySelected)
              }
            }
          } else if (dt) {
            let courses: string[] = [...JSON.parse(dt)]
            const selected = courses[Number(response) - 1]

            if (selected) {
              const course = await Courses.findById(selected)
              if (course) {
                let maxReached = await maxEnrollmentReached(course.settings, course.id, course.owner)
                if (maxReached) {
                  agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                    to: destination,
                    type: "text",
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    text: {
                      body: "Sorry, the maximum learner limit has been reached for this course"
                    }
                  })
                } else {
                  // check if the student exists
                  const student = await Students.findOne({ phoneNumber: destination })
                  if (student) {
                    await studentService.enrollStudentToCourse(student.id, selected, "qr")
                    redisClient.del(keyLastRequest)
                  } else {
                    const keySelected = `${config.redisBaseKey}selected:${destination}`
                    await redisClient.set(keySelected, selected)
                    // get the course

                    // get course settings
                    const fields = [{
                      question: `What is your full name?`,
                      field: "name",
                      done: false
                    }]
                    if (fields[0]) {
                      fields.push({
                        question: `Please select your time zone.\nIt shall help us send you course reminders at the right time\n\n`,
                        field: "tz",
                        done: false
                      })
                      // create the student
                      await Students.create({
                        phoneNumber: destination,
                      })
                      await redisClient.set(fieldKey, fields[0].field)
                      await redisClient.set(fieldsKey, JSON.stringify(fields))
                      await redisClient.set(keySelected, course.id)
                      // send the question for fields[0]
                      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                        to: destination,
                        type: "text",
                        messaging_product: "whatsapp",
                        recipient_type: "individual",
                        text: {
                          body: `Please answer the next 2 questions to help us enroll you.\n\nQ (1/2)\n\n${fields[0].question}\n\n\Please type your response.`
                        }
                      })
                    }
                  }
                }
              } else {
                agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                  to: destination,
                  type: "text",
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  text: {
                    body: "You have provided an invalid entry, please try again"
                  }
                })
              }
            } else {
              agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                to: destination,
                type: "text",
                messaging_product: "whatsapp",
                recipient_type: "individual",
                text: {
                  body: "You have provided an invalid entry, please try again"
                }
              })
            }
          } else if (enrollment) {
            handleSurveyFreeform(response, enrollment, destination, v4())
          }
          break

        case "/enroll":
          // await generateCourseFlow("4f260e57-d4d7-45e1-aa17-7754362f7115")
          // const messageid = await startCourse(destination, "4f260e57-d4d7-45e1-aa17-7754362f7115")
          // await sendWelcome("4f260e57-d4d7-45e1-aa17-7754362f7115", destination, messageid)
          break
        default:
          let teamCourses = response.includes("want to see courses")
          let singleCourse = response.includes("want to start the course")
          field = await redisClient.get(fieldKey)
          if (teamCourses || singleCourse) {
            redisClient.del(fieldKey)
            redisClient.del(fieldsKey)
            redisClient.del(keySelected)
            redisClient.del(keyLastRequest)
            if (teamCourses) {
              // get the course short code
              const extractId = function (text: string) {
                const startIdIndex = text.indexOf('(id: _')
                const endIdIndex = text.indexOf('_)', startIdIndex)

                if (startIdIndex !== -1 && endIdIndex !== -1) {
                  const shortCode = text.substring(startIdIndex + 5, endIdIndex).replace("_", "")
                  console.log(shortCode)
                  return [shortCode]
                } else {
                  console.log("no deuce")
                  return undefined
                }
              }
              const match = extractId(response)
              if (match && match[0]) {
                let code = match[0]
                const { name, courses, owner } = await resolveTeamCourseWithShortcode(code)

                const key = `${config.redisBaseKey}last_request:${destination}`
                agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                  to: destination,
                  team: owner,
                  type: "text",
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  "text": {
                    "body": `These are courses published by *${name}*\n\nSend the corresponding number as a text message to enroll in that particular course\n${courses.map((course, index) => `\n${index + 1}. *${course.title.trim()}*`).join('.')}`
                  }
                })
                await redisClient.set(key, JSON.stringify(courses.map(e => e.id)))
              }
            }
            if (singleCourse) {
              // get the course short code
              const extractGroupAndId = function (text: string) {
                const startIdIndex = text.indexOf('(id: _')
                const endIdIndex = text.indexOf('_)', startIdIndex)
                const startGroupIndex = text.indexOf('(group: _')
                const endGroupIndex = text.indexOf('_)', startGroupIndex)

                if (startIdIndex !== -1 && endIdIndex !== -1 && startGroupIndex !== -1 && endGroupIndex !== -1) {
                  const shortCode = text.substring(startIdIndex + 5, endIdIndex).replace("_", "")
                  const cohort = text.substring(startGroupIndex + 8, endGroupIndex).replace("_", "")
                  console.log(cohort, shortCode)
                  return [shortCode, cohort]
                } else {
                  console.log("no deuce")
                  return undefined
                }
              }
              const match = extractGroupAndId(response)
              if (match && match[0]) {
                let code = match[0]
                let group = match[1]
                const course = await resolveCourseWithShortcode(code)
                let cohort
                if (group) {
                  cohort = await resolveCohortWithShortCode(group)
                }
                if (!course) {
                  agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                    to: destination,
                    type: "text",
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    text: {
                      body: "We could not find any course for this organization with that identifier"
                    }
                  })
                } else {
                  // check max enrollment
                  let maxReached = await maxEnrollmentReached(course.settings, course.id, course.owner)
                  if (maxReached) {
                    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                      to: destination,
                      type: "text",
                      team: course.owner,
                      messaging_product: "whatsapp",
                      recipient_type: "individual",
                      text: {
                        body: "Sorry, the maximum learner limit has been reached for this course"
                      }
                    })
                  } else {
                    const student = await Students.findOne({ phoneNumber: destination })
                    if (student) {
                      await studentService.enrollStudentToCourse(student.id, course.id, "qr", {}, cohort ? cohort.id : null)
                    } else {
                      const fields = [{
                        question: `What is your full name?`,
                        field: "name",
                        done: false
                      }]
                      if (fields[0]) {
                        fields.push({
                          question: `Please select your time zone.\nIt shall help us send you course reminders at the right time\n\n`,
                          field: "tz",
                          done: false
                        })
                        // create the student
                        await Students.create({
                          phoneNumber: destination,
                        })
                        const keySelected = `${config.redisBaseKey}selected:${destination}`
                        await redisClient.set(fieldKey, fields[0].field)
                        await redisClient.set(fieldsKey, JSON.stringify(fields))
                        await redisClient.set(keySelected, course.id)
                        if (cohort) {
                          await redisClient.set(`${config.redisBaseKey}selected_cohort:${destination}`, cohort.id)
                        }
                        // send the question for fields[0]
                        agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                          to: destination,
                          type: "text",
                          team: course.owner,
                          messaging_product: "whatsapp",
                          recipient_type: "individual",
                          text: {
                            body: `Please answer the next 2 questions to help us enroll you.\n\nQ (1/2)\n\n${fields[0].question}\n\n\Please type your response.`
                          }
                        })
                      }
                    }
                  }
                }
              }
            }
          } else if (field) {
            fieldsRaw = await redisClient.get(fieldsKey)
            let payload: any = {}
            if (field === "name") {
              const names = messageBody[0].text.body.split(' ')
              payload["firstName"] = names[0]
              payload['otherNames'] = names.slice(1).join(' ')
            }
            await Students.updateOne({ phoneNumber: destination }, { $set: payload })
            if (fieldsRaw) {
              let fields: {
                field: string,
                question: string,
                done: boolean
              }[] = JSON.parse(fieldsRaw)
              let index = fields.findIndex(e => e.field === field)
              if (index >= 0) {
                // @ts-ignore
                fields[index].done = true
              }
              let left = fields.filter(e => !e.done)
              if (left.length > 0 && left[0]) {
                let next = left[0]
                await redisClient.set(fieldKey, next.field)
                await redisClient.set(fieldsKey, JSON.stringify(fields))
                // send the question for the next 
                let message = `${next.question}\n\n\Type and send your responses as a text message.`
                if (next.field === 'tz') {
                  message = `Q (2/2)\n\n${next.question} ${timezones.map((zone, index) => `\n${index + 1}. *${zone.name.trim()}*`).join('.')}\n\nRespond with the correct index no. for your time zone.`
                }
                agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                  to: destination,
                  type: "text",
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  text: {
                    body: message
                  }
                })
              } else {
                const student = await Students.findOneAndUpdate({ phoneNumber: destination }, { $set: { verified: true } })
                // 
                const keySelected = `${config.redisBaseKey}selected:${destination}`
                let courseId = await redisClient.get(keySelected)
                if (courseId && student) {
                  let cohort = await redisClient.get(`${config.redisBaseKey}selected_cohort:${destination}`)
                  await studentService.enrollStudentToCourse(student.id, courseId, "qr", {}, cohort ? cohort : undefined)
                }
              }
            }
          } else if (enrollment) {
            handleSurveyFreeform(response, enrollment, destination, v4())
          }
          break
      }
    } else if (type === "button") {
      const response = messageBody[0].button.payload
      if (response === "Start") {
        if (enrollment) {
          let msgId = v4()
          await handleContinue(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, destination, msgId, enrollment)
          const key = `${config.redisBaseKey}enrollments:${destination}:${enrollment.id}`
          redisClient.set(key, JSON.stringify({ ...enrollment, currentBlock: enrollment.currentBlock + 1, lastMessageId: msgId, nextBlock: enrollment.nextBlock + 1 }))
        }
      }

      if (response === "Begin now") {
        if (enrollment) {
          let msgId = v4()
          await handleContinue(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, destination, msgId, enrollment)
          // const key = `${config.redisBaseKey}enrollments:${destination}:${enrollment.id}`
          // redisClient.set(key, JSON.stringify({ ...enrollment, currentBlock: enrollment.currentBlock + 1, lastMessageId: msgId, nextBlock: enrollment.nextBlock + 1 }))
        }
      }


    }

  }
  return res.send()
})

export const convertBlockContentToWhatsapp = catchAsync(async (req: Request, res: Response) => {
  const { blockId } = req.params
  if (blockId) {
    const block = await Blocks.findById(blockId)
    if (block) {
      res.status(httpStatus.OK).send({ data: convertToWhatsAppString(he.decode(block.content)) })
    }
  }

})



export const FacebookTokenExchange = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body
  await exchangeFacebookToken(payload.code, req.user.team)
  const team = await teamService.fetchTeamById(req.user.team)
  res.status(httpStatus.OK).send({ message: "Facebook access has been saved.", data: team })
})

export const ReloadTemplates = catchAsync(async (req: Request, res: Response) => {
  if (req.params['teamId']) {
    await reloadTemplates(req.params['teamId'])
    const team = await teamService.fetchTeamById(req.params['teamId'])
    res.status(httpStatus.OK).send({ message: "Facebook access has been saved.", data: team })
  } else {
    res.status(httpStatus.OK).send({ message: "Facebook access has been saved." })
  }
})




export const FacebookUninstall = catchAsync(async (req: Request, res: Response) => {
  let team = await teamService.fetchTeamById(req.user.team)
  if (team && team.facebookToken) {
    team.facebookToken = null
    await team.save()
  }
  res.status(httpStatus.OK).send({ message: "Facebook access has been revoked.", data: team })
})

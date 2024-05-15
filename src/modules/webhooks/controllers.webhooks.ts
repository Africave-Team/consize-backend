import httpStatus from 'http-status'
import he from "he"
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { agenda } from '../scheduler'
import { RESUME_TOMORROW, SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { CONTINUE, QUIZ_A, QUIZ_B, QUIZ_C, QUIZ_NO, QUIZ_YES, Message, CERTIFICATES, COURSES, STATS, START, CourseEnrollment, SURVEY_A, SURVEY_B, SURVEY_C, TOMORROW, SCHEDULE_RESUMPTION, MORNING, AFTERNOON, EVENING, RESUME_COURSE } from './interfaces.webhooks'
import { convertToWhatsAppString, fetchEnrollments, handleBlockQuiz, handleContinue, handleLessonQuiz, handleSurveyFreeform, handleSurveyMulti, scheduleInactivityMessage, sendResumptionOptions, sendScheduleAcknowledgement } from "./service.webhooks"
import config from '../../config/config'
import { redisClient } from '../redis'
import { v4 } from 'uuid'
import Blocks from '../courses/model.blocks'
import moment from 'moment-timezone'
import { resolveCourseWithShortcode, resolveTeamCourseWithShortcode } from '../courses/service.courses'
import { studentService } from '../students'
import { courseService } from '../courses'
import Settings from '../courses/model.settings'
import Students from '../students/model.students'
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
      const response = messageBody[0].interactive.button_reply.id
      const [btnId, messageId] = response.split('|')
      if (messageId) {
        if (enrollment) {
          if (enrollment.lastMessageId && enrollment.lastMessageId !== messageId) {
            return res.send()
          }
        }
      }
      switch (btnId) {
        case START:
        case RESUME_COURSE:
        case CONTINUE:
          if (enrollment) {
            let msgId = v4()
            await handleContinue(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, destination, msgId, enrollment)
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
            await handleLessonQuiz(answerResponse, enrollment, destination, msgId)
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
            // agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
            //   to: destination,
            //   type: "text",
            //   messaging_product: "whatsapp",
            //   recipient_type: "individual",
            //   text: {
            //     body: "The following message would include your ongoing course enrollments. Click the continue of any one of them to resume that course"
            //   }
            // })
          }
          for (let enrollment of enrollments) {
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: destination,
              type: "interactive",
              messaging_product: "whatsapp",
              recipient_type: "individual",
              interactive: {
                body: {
                  text: `*${enrollment.title}*\n\n${enrollment.description}\n\n*Progress*: ${((enrollment.nextBlock / enrollment.totalBlocks) * 100).toFixed(0)}%`
                },
                type: "button",
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: `continue_${enrollment.id}`,
                        title: "Continue"
                      }
                    }
                  ]
                }
              }
            })
          }
          break
        case CERTIFICATES:

          break
        case SURVEY_A:
        case SURVEY_B:
        case SURVEY_C:
          let rsp = 0
          if (btnId === SURVEY_B) rsp = 1
          if (btnId === SURVEY_C) rsp = 2
          if (enrollment) {
            const msgId = v4()
            await handleSurveyMulti(rsp, enrollment, destination, msgId)
          }
          break
        case TOMORROW:
        case MORNING:
          if (enrollment) {
            let msgId = v4()
            const currentDate = moment().tz(enrollment.tz)

            // Set the time to 9am tomorrow
            const tomorrow9AM = currentDate.clone().add(1, 'day').startOf('day').hour(9)
            agenda.schedule(tomorrow9AM.toDate(), RESUME_TOMORROW, { messageId: msgId, enrollment, phoneNumber: destination })
            sendScheduleAcknowledgement(destination, "9:00am")
          }
          break
        case AFTERNOON:
          if (enrollment) {
            let msgId = v4()
            const currentDate = moment().tz(enrollment.tz)

            // Set the time to 9am tomorrow
            const tomorrow3PM = currentDate.clone().add(1, 'day').startOf('day').hour(15)
            agenda.schedule(tomorrow3PM.toDate(), RESUME_TOMORROW, { messageId: msgId, enrollment, phoneNumber: destination })
            sendScheduleAcknowledgement(destination, "3:00pm")
          }
          break
        case EVENING:
          if (enrollment) {
            let msgId = v4()
            const currentDate = moment().tz(enrollment.tz)

            // Set the time to 9am tomorrow
            const tomorrow8PM = currentDate.clone().add(1, 'day').startOf('day').hour(20)
            agenda.schedule(tomorrow8PM.toDate(), RESUME_TOMORROW, { messageId: msgId, enrollment, phoneNumber: destination })
            sendScheduleAcknowledgement(destination, "8:00pm")
          }
          break
        case SCHEDULE_RESUMPTION:
          if (enrollment) {
            const key = `${config.redisBaseKey}enrollments:${destination}:${enrollment.id}`
            sendResumptionOptions(destination, key, enrollment)
          }
          break
        default:
          if (btnId.startsWith('continue_')) {
            const courseId = btnId.replace("continue_", "")
            // continue a course from the positions message
            const enrollments: CourseEnrollment[] = await fetchEnrollments(destination)
            for (let enrollment of enrollments) {
              const key = `${config.redisBaseKey}enrollments:${destination}:${enrollment.id}`
              let msgId = v4()
              if (enrollment.id === courseId) {
                await handleContinue(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, destination, msgId, enrollment)
              }
              redisClient.set(key, JSON.stringify({ ...enrollment, active: enrollment.id === courseId, lastMessageId: msgId, currentBlock: enrollment.currentBlock + 1, nextBlock: enrollment.nextBlock + 1 }))
            }
          }
          break
      }
      // schedule inactivity message
      if (enrollment) {
        scheduleInactivityMessage(enrollment, destination)
      }

    } else if (type === "text") {
      const fieldKey = `${config.redisBaseKey}field:${destination}`
      const fieldsKey = `${config.redisBaseKey}fields:${destination}`
      const response = messageBody[0].text.body.toLowerCase()
      let field: string | null
      let fieldsRaw: string | null
      switch (response) {
        case "/sos":
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
          if (field && field === "tz") {
            let selected = timezones[Number(response) - 1]
            if (selected) {
              await Students.updateOne({ phoneNumber: destination }, { $set: { tz: selected.timezone } })
              fieldsRaw = await redisClient.get(fieldsKey)
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
                    message = `Select an appropriate timezone. \n\nThis will help us send you reminders at appropriate times\n\nSend the corresponding number as a text message\n${timezones.map((zone, index) => `\n${index + 1}. *${zone.name.trim()}*`).join('.')}`
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
                    await studentService.enrollStudentToCourse(student.id, courseId)
                    redisClient.del(fieldKey)
                    redisClient.del(fieldsKey)
                    redisClient.del(keySelected)
                  }
                }
              }
            }
          } else {
            const key = `${config.redisBaseKey}last_request:${destination}`
            const dt = await redisClient.get(key)
            let courses: string[] = []
            if (dt) {
              courses = [...JSON.parse(dt)]
            }
            const selected = courses[Number(response) - 1]

            if (selected) {
              // check if the student exists
              const student = await Students.findOne({ phoneNumber: destination })
              if (student) {
                await studentService.enrollStudentToCourse(student.id, selected)
                redisClient.del(key)
              } else {
                const keySelected = `${config.redisBaseKey}selected:${destination}`
                await redisClient.set(keySelected, selected)
                // get the course
                const course = await courseService.fetchSingleCourse({ courseId: selected })
                if (course) {
                  // get course settings
                  const settings = await Settings.findById(course.settings)
                  if (settings) {
                    const fields = settings.enrollmentFormFields.filter(e => e.defaultField && e.variableName !== "phoneNumber").sort((a, b) => b.position - a.position).map((field) => {
                      return {
                        question: `What is your ${field.fieldName}`,
                        field: field.variableName,
                        done: false
                      }
                    })
                    if (fields[0]) {
                      fields.push({
                        question: `What is your timezone?\n\n`,
                        field: "tz",
                        done: false
                      })
                      // create the student
                      await Students.create({
                        phoneNumber: destination,
                      })
                      await redisClient.set(fieldKey, fields[0].field)
                      await redisClient.set(fieldsKey, JSON.stringify(fields))
                      redisClient.del(key)
                      // send the question for fields[0]
                      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                        to: destination,
                        type: "text",
                        messaging_product: "whatsapp",
                        recipient_type: "individual",
                        text: {
                          body: `Please answer the following questions, starting with this one\n\n${fields[0].question}\n\n\Type and send your responses as a text message.`
                        }
                      })
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
          if (field) {
            fieldsRaw = await redisClient.get(fieldsKey)
            let payload: any = {}
            payload[field] = response
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
                  message = `Select an appropriate timezone. \n\nThis will help us send you reminders at appropriate times\n\nSend the corresponding number as a text message\n${timezones.map((zone, index) => `\n${index + 1}. *${zone.name.trim()}*`).join('.')}`
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
                  await studentService.enrollStudentToCourse(student.id, courseId)
                }
              }
            }
          } else if (teamCourses || singleCourse) {
            if (teamCourses) {
              // get the course short code
              let contents = response.split('\n')
              let length = contents.length
              let code = contents[length - 1].replaceAll('_', '')
              const { name, courses } = await resolveTeamCourseWithShortcode(code)
              const key = `${config.redisBaseKey}last_request:${destination}`
              agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                to: destination,
                type: "text",
                messaging_product: "whatsapp",
                recipient_type: "individual",
                "text": {
                  "body": `These are courses published by *${name}*\n\nSend the corresponding number as a text message to enroll in that particular course\n${courses.map((course, index) => `\n${index + 1}. *${course.title.trim()}*`).join('.')}`
                }
              })
              await redisClient.set(key, JSON.stringify(courses.map(e => e.id)))
            }
            if (singleCourse) {
              // get the course short code
              let contents = response.split('\n')
              let length = contents.length
              let code = contents[length - 1].replaceAll('_', '')
              const course = await resolveCourseWithShortcode(code)
              console.log(course)
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
                const student = await Students.findOne({ phoneNumber: destination })
                console.log(student)
                if (student) {
                  await studentService.enrollStudentToCourse(student.id, course.id)
                } else {
                  // get course settings
                  const settings = await Settings.findById(course.settings)
                  console.log(settings, "settings")
                  if (settings) {
                    const fields = settings.enrollmentFormFields.filter(e => e.defaultField && e.variableName !== "phoneNumber").sort((a, b) => b.position - a.position).map((field) => {
                      return {
                        question: `What is your ${field.fieldName}`,
                        field: field.variableName,
                        done: false
                      }
                    })
                    console.log(fields, settings.enrollmentFormFields)
                    if (fields[0]) {
                      fields.push({
                        question: `What is your timezone?\n\n`,
                        field: "tz",
                        done: false
                      })
                      // create the student
                      await Students.create({
                        phoneNumber: destination,
                      })
                      await redisClient.set(fieldKey, fields[0].field)
                      await redisClient.set(fieldsKey, JSON.stringify(fields))
                      // send the question for fields[0]
                      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                        to: destination,
                        type: "text",
                        messaging_product: "whatsapp",
                        recipient_type: "individual",
                        text: {
                          body: `Please answer the following questions, starting with this one\n\n${fields[0].question}\n\n\Type and send your responses as a text message.`
                        }
                      })
                    }
                  }
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
      console.log(response)
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
          const key = `${config.redisBaseKey}enrollments:${destination}:${enrollment.id}`
          redisClient.set(key, JSON.stringify({ ...enrollment, currentBlock: enrollment.currentBlock + 1, lastMessageId: msgId, nextBlock: enrollment.nextBlock + 1 }))
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

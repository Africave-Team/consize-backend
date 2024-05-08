import httpStatus from 'http-status'
import he from "he"
import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { agenda } from '../scheduler'
import { RESUME_TOMORROW, SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { CONTINUE, QUIZ_A, QUIZ_B, QUIZ_C, QUIZ_NO, QUIZ_YES, Message, CERTIFICATES, COURSES, STATS, START, CourseEnrollment, SURVEY_A, SURVEY_B, SURVEY_C, TOMORROW, SCHEDULE_RESUMPTION, MORNING, AFTERNOON, EVENING, RESUME_COURSE } from './interfaces.webhooks'
import { convertToWhatsAppString, fetchEnrollments, handleBlockQuiz, handleContinue, handleLessonQuiz, handleSurveyFreeform, handleSurveyMulti, sendResumptionOptions, sendScheduleAcknowledgement } from "./service.webhooks"
import config from '../../config/config'
import { redisClient } from '../redis'
import { v4 } from 'uuid'
import Blocks from '../courses/model.blocks'
import moment from 'moment'
// import { logger } from '../logger'

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
      console.log(btnId)
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
            agenda.schedule(`tomorrow at 9 am`, RESUME_TOMORROW, { messageId: msgId, enrollment, phoneNumber: destination })
            sendScheduleAcknowledgement(destination, "9:00am")
          }
          break
        case AFTERNOON:
          if (enrollment) {
            let msgId = v4()
            agenda.schedule(`tomorrow at 3 pm`, RESUME_TOMORROW, { messageId: msgId, enrollment, phoneNumber: destination })
            sendScheduleAcknowledgement(destination, "3:00pm")
          }
          break
        case EVENING:
          if (enrollment) {
            let msgId = v4()
            agenda.schedule(`tomorrow at 8 pm`, RESUME_TOMORROW, { messageId: msgId, enrollment, phoneNumber: destination })
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

    } else if (type === "text") {
      const response = messageBody[0].text.body.toLowerCase()
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

        case "/enroll":
          // await generateCourseFlow("4f260e57-d4d7-45e1-aa17-7754362f7115")
          // const messageid = await startCourse(destination, "4f260e57-d4d7-45e1-aa17-7754362f7115")
          // await sendWelcome("4f260e57-d4d7-45e1-aa17-7754362f7115", destination, messageid)
          break
        default:
          if (enrollment) {
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

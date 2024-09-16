import httpStatus from 'http-status'
import { Request, Response } from 'express'
import { catchAsync } from '../utils'
import { slackServices } from '.'
import { teamService } from '../teams'
import { FetchChannels, Fetchmembers, MessageBlockType, SendSlackMessagePayload, SendSlackResponsePayload, SlackResponse, SlackTextMessageTypes } from './interfaces.slack'
import { CourseEnrollment, RESUME_COURSE, START, CONTINUE, QUIZ_NO, QUIZ_YES, QUIZ_A, QUIZ_B, QUIZ_C, STATS, COURSES, CERTIFICATES, SURVEY_B, SURVEY_C, TOMORROW, MORNING, AFTERNOON, EVENING, SCHEDULE_RESUMPTION, ACCEPT_INVITATION, REJECT_INVITATION, RESUME_COURSE_TOMORROW, QUIZA_A, QUIZA_B, QUIZA_C } from '../webhooks/interfaces.webhooks'
import { fetchEnrollmentsSlack, handleContinueSlack, handleBlockQuiz, handleLessonQuiz, handleSurvey, sendResumptionOptions, sendScheduleAcknowledgement, handleSendSurveySlack, handleAssessment } from './slack.services'
import { Student } from '../students'
import { agenda } from '../scheduler'
import { RESUME_TOMORROW, SEND_CERTIFICATE_SLACK, SEND_SLACK_MESSAGE, SEND_SLACK_RESPONSE } from '../scheduler/MessageTypes'
import { v4 } from 'uuid'
import config from '../../config/config'
import { Job } from 'agenda'
import { CourseFlowMessageType, scheduleInactivityMessage } from '../webhooks/service.webhooks'
import Students from '../students/model.students'
import Teams from '../teams/model.teams'
import { redisClient } from '../redis'
import moment from 'moment'
// import { courseService } from '../courses'
// import moment from 'moment'


export const SlackWebhookChallengeHandler = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body
  res.status(httpStatus.OK).send(payload.challenge)
})


export const SlackWebhookHandler = catchAsync(async (req: Request, res: Response) => {
  agenda.define<SlackResponse>("process-slack-webhook", async function (job: Job<SlackResponse>) {
    const response = job.attrs.data
    if (response.type === "block_actions") {
      const { user, actions, channel, response_url, trigger_id } = response
      const student = await Student.findOne({ slackId: user.id })
      if (student) {
        const [action] = actions
        if (action && action.value) {
          let enrollments: CourseEnrollment[] = await fetchEnrollmentsSlack(channel.id)
          let enrollment: CourseEnrollment | undefined = enrollments.find(e => e.active)
          const [btnId, messageId] = action.value.split('|')
          if (messageId && !btnId?.startsWith("continue_")) {
            if (enrollment) {
              if (enrollment.lastMessageId && enrollment.lastMessageId !== messageId) {
                return
              }
            }
          }
          console.log(btnId, messageId, enrollment?.lastMessageId)
          let today = moment().add(24, "hours").format('YYYY-MM-DD')
          switch (btnId) {
            case START:
            case RESUME_COURSE:
            case RESUME_COURSE_TOMORROW:
            case CONTINUE:
              if (enrollment) {
                let msgId = v4()
                await handleContinueSlack(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, channel.id, response_url, msgId, enrollment)
                scheduleInactivityMessage(enrollment, undefined, channel.id)
                // jwihrtuiojwer
                // exhnage
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
                handleBlockQuiz(answer, enrollment, response_url, msgId, channel.id)
                scheduleInactivityMessage(enrollment, undefined, channel.id)
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
                console.log("lesson quiz")
                await handleLessonQuiz(answerResponse, enrollment, response_url, msgId, channel.id)
                scheduleInactivityMessage(enrollment, undefined, channel.id)
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
                await handleAssessment(choice, enrollment, response_url, channel.id, msgId)
                // schedule inactivity message
                scheduleInactivityMessage(enrollment, undefined, channel.id)
              }
              break
            case STATS:

              break
            case CourseFlowMessageType.START_SURVEY:
              console.log("start survey")
              if (enrollment && enrollment.slackToken && enrollment.surveyData) {
                await handleSendSurveySlack(`${config.redisBaseKey}courses:${enrollment.id}`, enrollment, trigger_id)
                const key = `${config.redisBaseKey}enrollments:slack:${channel.id}:${enrollment?.id}`
                let copy = { ...enrollment }
                copy.lastMessageId = v4()
                await redisClient.set(key, JSON.stringify({ ...copy }))
                scheduleInactivityMessage(enrollment, undefined, channel.id)
              }
              break
            case COURSES:
              if (enrollments.length === 0) {
                // agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                //   to: destination,
                //   type: "text",
                //   messaging_product: "whatsapp",
                //   recipient_type: "individual",
                //   text: {
                //     body: "You do not have any ongoing courses."
                //   }
                // })
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
              for (let _ of enrollments) {
                // agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                //   to: destination,
                //   type: "interactive",
                //   messaging_product: "whatsapp",
                //   recipient_type: "individual",
                //   interactive: {
                //     body: {
                //       text: `*${enrollment.title}*\n\n${enrollment.description}\n\n*Progress*: ${((enrollment.nextBlock / enrollment.totalBlocks) * 100).toFixed(0)}%`
                //     },
                //     type: "button",
                //     action: {
                //       buttons: [
                //         {
                //           type: "reply",
                //           reply: {
                //             id: `continue_${enrollment.id}`,
                //             title: "Continue"
                //           }
                //         }
                //       ]
                //     }
                //   }
                // })
              }
              break
            case CERTIFICATES:

              break
            case TOMORROW:
            case MORNING:

              if (enrollment) {
                let msgId = v4()
                const dateTimeString = `${today} 09:00` // Note: removed 'PM'
                const now = moment.tz(enrollment.tz)
                const time = moment(dateTimeString).subtract(now.utcOffset(), 'minutes')
                agenda.schedule(time.toDate(), RESUME_TOMORROW, { messageId: msgId, enrollment, channelId: channel.id })
                sendScheduleAcknowledgement(response_url, "9:00AM")
              }
              break
            case AFTERNOON:
              if (enrollment) {
                let msgId = v4()
                const dateTimeString = `${today} 15:00` // Note: removed 'PM'
                const now = moment.tz(enrollment.tz)
                const time = moment(dateTimeString).subtract(now.utcOffset(), 'minutes')
                agenda.schedule(time.toDate(), RESUME_TOMORROW, { messageId: msgId, enrollment, channelId: channel.id })
                sendScheduleAcknowledgement(response_url, "3:00PM")
              }
              break
            case EVENING:
              if (enrollment) {
                let msgId = v4()
                const dateTimeString = `${today} 20:00` // Note: removed 'PM'
                const now = moment.tz(enrollment.tz)
                const time = moment(dateTimeString).subtract(now.utcOffset(), 'minutes')
                agenda.schedule(time.toDate(), RESUME_TOMORROW, { messageId: msgId, enrollment, channelId: channel.id })
                sendScheduleAcknowledgement(response_url, "8:00PM")
              }
              break
            case SCHEDULE_RESUMPTION:
              if (enrollment) {
                const key = `${config.redisBaseKey}enrollments:slack:${channel.id}:${enrollment.id}`
                sendResumptionOptions(response_url, key, enrollment)
              }
              break
            case ACCEPT_INVITATION:
            case REJECT_INVITATION:
              if (student.rejected || student.verified) {
                break
              }
              if (btnId === ACCEPT_INVITATION) {
                student.verified = true
                await student.save()
                agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
                  url: response_url,
                  message: {
                    blocks: [
                      {
                        type: MessageBlockType.SECTION,
                        fields: [
                          {
                            type: SlackTextMessageTypes.MARKDOWN,
                            text: `You have accepted this invitation. Subsequently, courses can be sent to you from your workspace admin and you can take those courses right here in your DM`
                          }
                        ]
                      }
                    ]
                  }
                })
              } else {
                student.rejected = true
                await student.save()
                agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
                  url: response_url,
                  message: {
                    blocks: [
                      {
                        type: MessageBlockType.SECTION,
                        fields: [
                          {
                            type: SlackTextMessageTypes.MARKDOWN,
                            text: `You have chosen to not receive these courses. Subsequently, courses will not be sent to you from your workspace admin.`
                          }
                        ]
                      }
                    ]
                  }
                })
              }
              break
            default:
              if (btnId) {
                if (btnId.startsWith('continue_')) {
                  const courseId = btnId.replace("continue_", "")
                  // continue a course from the positions message
                  const enrollments: CourseEnrollment[] = await fetchEnrollmentsSlack(channel.id)
                  for (let enrollment of enrollments) {
                    const key = `${config.redisBaseKey}enrollments:slack:${channel.id}:${enrollment.id}`
                    let msgId = v4()
                    await redisClient.set(key, JSON.stringify({ ...enrollment, active: enrollment.id === courseId }))
                    if (enrollment.id === courseId) {
                      await handleContinueSlack(enrollment.currentBlock, `${config.redisBaseKey}courses:${enrollment.id}`, channel.id, response_url, msgId, { ...enrollment, currentBlock: enrollment.currentBlock - 1, nextBlock: enrollment.currentBlock })
                    }
                  }
                }
                // if (btnId.startsWith('enroll_now_')) {
                //   const courseId = btnId.replace("enroll_now_", "")
                //   slackServices.startEnrollmentSlack(student.id, courseId)
                // }
                // if (btnId.startsWith('enroll_default_time_')) {
                //   const courseId = btnId.replace("enroll_default_time_", "")
                //   // continue a course from the positions message
                //   const course = await courseService.fetchSingleCourse({ courseId })
                //   if (course) {
                //     let settings = await courseService.fetchSingleSettings(course.settings)
                //     if (settings && settings.resumption) {
                //       let date = moment().add(settings.resumption.days, 'days')
                //       let day = date.format('dddd, Do of MMMM, YYYY')
                //       const now = moment.tz(student.tz)
                //       const [h, m] = settings.resumption.time.split(':')
                //       let hours = Number(h), minutes = Number(m)
                //       let dayFormatted = moment().add(settings.resumption.days, 'days').format('YYYY-MM-DD')
                //       const time = moment(`${dayFormatted}`).hour(hours).minute(minutes).subtract(now.utcOffset(), 'minutes')
                //       agenda.schedule<{ studentId: string, courseId: string }>(time.toDate(), ENROLL_STUDENT_DEFAULT_DATE, { courseId, studentId: student.id })
                //       slackServices.sendEnrollmentScheduleAcknowledgement(response_url, `Thank you. You have scheduled to start the course *${course.title}* by ${date.hour(hours).minute(minutes).format('h:mmA')} on ${day}.\n\n We will begin sending you this course content on the above date and time.`)
                //     }
                //   }
                // }
                // if (btnId.startsWith('choose_enroll_time_')) {
                //   // const courseId = btnId.replace("choose_enroll_time_", "")
                //   // // continue a course from the positions message

                //   // for (let index = 0; index < 7; index++) {

                //   // }
                // }
              }
              break
          }


        }
      }
    }
    if (response.type === "view_submission") {
      let metadata: any = {}
      if (response.view.callback_id) {
        for (let ted of response.view.callback_id.split('|')) {
          const [key, value] = ted.split('=')
          if (key && value) {
            metadata[key] = value
          }
        }
      }
      if (metadata.student && metadata.team) {
        const student = await Students.findOne({ slackId: response.user.id })
        const owner = await Teams.findById(metadata.team)
        if (student && student.channelId) {
          let enrollments: CourseEnrollment[] = await fetchEnrollmentsSlack(student.channelId)
          let enrollment: CourseEnrollment | undefined = enrollments.find(e => e.active)
          if (enrollment && response.view && response.view.state) {
            const values = response.view.state.values
            // Iterate over each key-value pair using Object.entries()
            for (const [key, value] of Object.entries(values)) {
              // Create a new object with the key as the id field
              const child = Object.values(value)
              // @ts-ignore
              if (child[0]) {
                let vs = child[0]
                let newObj
                if (vs.value) {
                  newObj = { id: key, response: vs.value, multi: false }
                }
                if (vs.selected_option && vs.selected_option.value) {
                  newObj = { id: key, response: vs.selected_option.value, multi: true }
                }
                if (newObj && newObj.response) {
                  if (newObj.multi) {
                    let rsp = 0
                    if (newObj.response === SURVEY_B) rsp = 1
                    if (newObj.response === SURVEY_C) rsp = 2
                    await handleSurvey(rsp, enrollment, metadata.survey, newObj.id, newObj.multi, newObj.response)
                  } else {
                    await handleSurvey(0, enrollment, metadata.survey, newObj.id, newObj.multi, newObj.response)
                  }
                }

              }
            }

            if (owner && owner.slackToken) {
              agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
                accessToken: owner.slackToken,
                channel: student.channelId,
                message: {
                  blocks: [
                    {
                      type: MessageBlockType.SECTION,
                      fields: [
                        {
                          type: SlackTextMessageTypes.MARKDOWN,
                          text: `Thank you for sharing your opinions. We greatly appreciate you taking the time.`

                        }
                      ]
                    }
                  ]
                }
              })
            }

            agenda.now<CourseEnrollment>(SEND_CERTIFICATE_SLACK, {
              ...enrollment,
              slackResponseUrl: response.response_url
            })
            const key = `${config.redisBaseKey}enrollments:slack:${student.channelId}:${enrollment.id}`
            enrollment.completed = true
            enrollment.progress = 100
            enrollment.currentBlock = enrollment.totalBlocks
            enrollment.nextBlock = enrollment.totalBlocks
            await redisClient.set(key, JSON.stringify({ ...enrollment, progress: 100, completed: true }))
          }
        }
      }
    }
  })
  const { payload: ld } = req.body
  if (ld) {
    const response: SlackResponse = JSON.parse(ld)
    agenda.now<SlackResponse>("process-slack-webhook", response)
  }
  res.status(httpStatus.OK).send()
})

export const SlackTokenExchange = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body
  await slackServices.handleSlackTokenExchange(payload.code, req.user.team)
  const team = await teamService.fetchTeamById(req.user.team)
  res.status(httpStatus.OK).send({ message: "Slack access has been saved.", data: team })
})


export const SlackUninstall = catchAsync(async (req: Request, res: Response) => {
  let team = await teamService.fetchTeamById(req.user.team)
  if (team && team.slackToken) {
    await slackServices.handleAppUninstall(team.slackToken)
    team.slackToken = null
    await team.save()
  }
  res.status(httpStatus.OK).send({ message: "Slack access has been revoked.", data: team })
})

export const FetchSlackChannels = catchAsync(async (req: Request, res: Response) => {
  const team = await teamService.fetchTeamById(req.user.team)
  let items: FetchChannels = {
    channels: [],
    response_metadata: {
      next_cursor: ''
    }
  }
  if (team && team.slackToken) {
    items = await slackServices.fetchSlackChannels(team.slackToken)
  }
  res.status(httpStatus.OK).send({ message: "Slack access has been saved.", data: items })
})

export const FetchSlackMembers = catchAsync(async (req: Request, res: Response) => {
  const team = await teamService.fetchTeamById(req.user.team)
  let items: Fetchmembers = {
    members: [],
    response_metadata: {
      next_cursor: ''
    }
  }
  if (team && team.slackToken) {
    items = await slackServices.fetchSlackMembers(team.slackToken)
  }
  res.status(httpStatus.OK).send({ message: "Slack access has been saved.", data: items })
})


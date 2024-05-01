import httpStatus from 'http-status'
import { Request, Response } from 'express'
import { catchAsync } from '../utils'
import { slackServices } from '.'
import { teamService } from '../teams'
import { FetchChannels, Fetchmembers, MessageBlockType, SendSlackModalPayload, SendSlackResponsePayload, SlackActionType, SlackResponse, SlackTextMessageTypes } from './interfaces.slack'
import { CourseEnrollment, RESUME_COURSE, START, CONTINUE, QUIZ_NO, QUIZ_YES, QUIZ_A, QUIZ_B, QUIZ_C, STATS, COURSES, CERTIFICATES, SURVEY_A, SURVEY_B, SURVEY_C, TOMORROW, MORNING, AFTERNOON, EVENING, SCHEDULE_RESUMPTION, ACCEPT_INVITATION, REJECT_INVITATION } from '../webhooks/interfaces.webhooks'
import { fetchEnrollmentsSlack, handleContinueSlack, handleBlockQuiz, handleLessonQuiz, handleSurveyMulti, sendResumptionOptions, sendScheduleAcknowledgement } from './slack.services'
import { Student } from '../students'
import { agenda } from '../scheduler'
import { RESUME_TOMORROW, SEND_SLACK_MODAL, SEND_SLACK_RESPONSE } from '../scheduler/MessageTypes'
import { v4 } from 'uuid'
import config from '../../config/config'
import { getMomentTomorrow } from '../webhooks/controllers.webhooks'
import { Job } from 'agenda'
import { CourseFlowMessageType } from '../webhooks/service.webhooks'


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
          if (messageId) {
            if (enrollment) {
              if (enrollment.lastMessageId && enrollment.lastMessageId !== messageId) {
                return
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
                await handleContinueSlack(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, channel.id, response_url, msgId, enrollment)
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
              }
              break
            case QUIZ_A:
            case QUIZ_B:
            case QUIZ_C:
              let answerResponse = 0
              if (btnId === QUIZ_B) answerResponse = 1
              if (btnId === QUIZ_C) answerResponse = 2
              if (enrollment) {
                console.log(answerResponse)
                const msgId = v4()
                await handleLessonQuiz(answerResponse, enrollment, response_url, msgId, channel.id)
              }
              break
            case STATS:

              break
            case CourseFlowMessageType.START_SURVEY:
              if (enrollment && enrollment.slackToken) {
                agenda.now<SendSlackModalPayload>(SEND_SLACK_MODAL, {
                  trigger_id,
                  token: enrollment.slackToken,
                  view: {
                    "type": "modal",
                    callback_id: `survey|${enrollment.student}`,
                    "submit": {
                      "type": SlackTextMessageTypes.PLAINTEXT,
                      "text": "Submit",
                      "emoji": true
                    },
                    "close": {
                      "type": SlackTextMessageTypes.PLAINTEXT,
                      "text": "Cancel",
                      "emoji": true
                    },
                    "title": {
                      "type": SlackTextMessageTypes.PLAINTEXT,
                      "text": "End of course survey",
                      "emoji": true
                    },
                    "blocks": [
                      {
                        "type": MessageBlockType.SECTION,
                        "text": {
                          "type": SlackTextMessageTypes.PLAINTEXT,
                          "text": ":wave: Hey David!\n\nWe'd love to hear from you how we can make this place the best place you’ve ever worked.",
                          "emoji": true
                        }
                      },
                      {
                        "type": MessageBlockType.DIVIDER
                      },
                      {
                        "type": MessageBlockType.INPUT,
                        "block_id": "opinion_input",
                        "label": {
                          "type": SlackTextMessageTypes.PLAINTEXT,
                          "text": "What do you want for our team weekly lunch?",
                          "emoji": true
                        },
                        "element": {
                          "type": SlackActionType.SELECT,
                          "action_id": "opinion_input_action",
                          "placeholder": {
                            "type": SlackTextMessageTypes.PLAINTEXT,
                            "text": "Select your favorites",
                            "emoji": true
                          },
                          "options": [
                            {
                              "text": {
                                "type": SlackTextMessageTypes.PLAINTEXT,
                                "text": ":pizza: Pizza",
                                "emoji": true
                              },
                              "value": "value-0"
                            },
                            {
                              "text": {
                                "type": SlackTextMessageTypes.PLAINTEXT,
                                "text": ":fried_shrimp: Thai food",
                                "emoji": true
                              },
                              "value": "value-1"
                            },
                            {
                              "text": {
                                "type": SlackTextMessageTypes.PLAINTEXT,
                                "text": ":desert_island: Hawaiian",
                                "emoji": true
                              },
                              "value": "value-2"
                            }
                          ]
                        }
                      },
                      {
                        "type": MessageBlockType.INPUT,
                        "block_id": "opinion_input_text",
                        "label": {
                          "type": SlackTextMessageTypes.PLAINTEXT,
                          "text": "What can we do to improve your experience working here?",
                          "emoji": true
                        },
                        "element": {
                          "type": SlackActionType.TEXTINPUT,
                          "multiline": true,
                          "action_id": "opinion_input_text_action",
                        }
                      }
                    ]
                  }
                })
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
            case SURVEY_A:
            case SURVEY_B:
            case SURVEY_C:
              let rsp = 0
              if (btnId === SURVEY_B) rsp = 1
              if (btnId === SURVEY_C) rsp = 2
              if (enrollment) {
                console.log(rsp)
                const msgId = v4()
                await handleSurveyMulti(rsp, enrollment, response_url, msgId, channel.id)
              }
              break
            case TOMORROW:
              if (enrollment) {
                let msgId = v4()
                agenda.schedule(`in ${getMomentTomorrow(9)} hours`, RESUME_TOMORROW, { messageId: msgId, enrollment, })
                sendScheduleAcknowledgement(response_url, "9:00am")
              }
              break
            case MORNING:
              if (enrollment) {
                let msgId = v4()
                agenda.schedule(`in ${getMomentTomorrow(9)} hours`, RESUME_TOMORROW, { messageId: msgId, enrollment })
                sendScheduleAcknowledgement(response_url, "9:00am")
              }
              break
            case AFTERNOON:
              if (enrollment) {
                let msgId = v4()
                agenda.schedule(`in ${getMomentTomorrow(15)} hours`, RESUME_TOMORROW, { messageId: msgId, enrollment })
                sendScheduleAcknowledgement(response_url, "3:00pm")
              }
              break
            case EVENING:
              if (enrollment) {
                let msgId = v4()
                agenda.schedule(`in ${getMomentTomorrow(20)} hours`, RESUME_TOMORROW, { messageId: msgId, enrollment })
                sendScheduleAcknowledgement(response_url, "8:00pm")
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
                return
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
                  console.log(courseId)
                  for (let _ of enrollments) {
                    // const key = `${config.redisBaseKey}enrollments:${destination}:${enrollment.id}`
                    // let msgId = v4()
                    // if (enrollment.id === courseId) {
                    //   await handleContinue(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, destination, msgId, enrollment)
                    // }
                    // redisClient.set(key, JSON.stringify({ ...enrollment, active: enrollment.id === courseId, lastMessageId: msgId, currentBlock: enrollment.currentBlock + 1, nextBlock: enrollment.nextBlock + 1 }))
                  }
                }
              }
              break
          }

        }
      }
    }
  })
  const { payload: ld } = req.body
  const response: SlackResponse = JSON.parse(ld)
  if (response.view && response.view.state) {
    console.log(response.view.state)
  }
  agenda.now<SlackResponse>("process-slack-webhook", response)
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


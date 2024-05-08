import axios, { AxiosResponse } from 'axios'
import config from '../../config/config'
import { teamService } from '../teams'
import { redisClient } from '../redis'
import { ApiError } from '../errors'
import httpStatus from 'http-status'
import he from "he"
import db from "../rtdb"
import { MessageActionButtonStyle, MessageBlockType, SendSlackMessagePayload, SendSlackModalPayload, SendSlackResponsePayload, SlackActionBlock, SlackActionType, SlackChannel, SlackMessage, SlackMessageBlock, SlackTextMessage, SlackTextMessageTypes, SlackUser } from './interfaces.slack'
import { CourseFlowItem, CourseFlowMessageType, convertToWhatsAppString, generateCourseFlow } from '../webhooks/service.webhooks'
import { agenda } from '../scheduler'
import { GENERATE_COURSE_TRENDS, SEND_CERTIFICATE_SLACK, SEND_LEADERBOARD_SLACK, SEND_SLACK_MESSAGE, SEND_SLACK_MODAL, SEND_SLACK_RESPONSE } from '../scheduler/MessageTypes'
import { CourseInterface } from '../courses/interfaces.courses'
import Courses from '../courses/model.courses'
import { v4 } from 'uuid'
import { AFTERNOON, CONTINUE, CourseEnrollment, EVENING, MORNING, QUIZ_A, QUIZ_B, QUIZ_C, QUIZ_NO, QUIZ_YES, RESUME_COURSE, SCHEDULE_RESUMPTION, SURVEY_A, SURVEY_B, SURVEY_C, TOMORROW } from '../webhooks/interfaces.webhooks'
import Students from '../students/model.students'
import Teams from '../teams/model.teams'
import { COURSE_STATS } from '../rtdb/nodes'
import { saveBlockDuration, saveCourseProgress, saveQuizDuration } from '../students/students.service'
import moment from 'moment'
import { StudentCourseStats } from '../students/interface.students'
import { delay } from '../generators/generator.service'
import { SurveyResponse } from '../surveys'
import { ResponseType } from '../surveys/survey.interfaces'
import Surveys from '../surveys/survey.model'

export const handleSlackWebhook = async function () { }

export const handleSlackTokenExchange = async function (code: string, teamId: string) {
  const result: AxiosResponse = await axios.post(`https://slack.com/api/oauth.v2.access`, {
    'client_id': config.slack.id,
    'client_secret': config.slack.secret,
    'code': code,
    'redirect_uri': config.slack.redirectUrl
  }, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  })

  if (result && result.status === 200) {
    if (result.data && result.data.ok) {
      const { access_token } = result.data
      await teamService.updateTeamInfo(teamId, { slackToken: access_token })
    } else {
      throw new ApiError(httpStatus.BAD_REQUEST, result.data.error)
    }
  }
}

export const handleAppUninstall = async function (token: string) {
  const result: AxiosResponse = await axios.post(`https://slack.com/api/apps.uninstall`, {
    'client_id': config.slack.id,
    'client_secret': config.slack.secret,
    'token': token
  }, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  })

  if (result && result.status === 200) {
    if (result.data && !result.data.ok) {
      throw new ApiError(httpStatus.BAD_REQUEST, result.data.error)
    }
  }
}

export const fetchSlackChannels = async function (slackToken: string) {
  const result: AxiosResponse<{ ok: boolean, channels: SlackChannel[], response_metadata: { next_cursor: '' } }> = await axios.get(`https://slack.com/api/conversations.list`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slackToken}`
    }
  })

  let channels: SlackChannel[] = []
  if (result.data && result.data.ok) {
    channels = result.data.channels.filter(e => e.num_members > 0).map(e => ({
      id: e.id,
      name: e.name,
      num_members: e.num_members
    }))
  }

  return { channels, response_metadata: result.data.response_metadata }
}


export const fetchSlackMembers = async function (slackToken: string) {
  const result: AxiosResponse<{ ok: boolean, members: SlackUser[], response_metadata: { next_cursor: '' } }> = await axios.get(`https://slack.com/api/users.list?include_deleted=false`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slackToken}`
    }
  })
  let members: SlackUser[] = []
  if (result.data && result.data.ok) {
    members = result.data.members.filter(e => !e.deleted && !e.is_bot && e.id !== 'USLACKBOT').map(e => ({
      id: e.id,
      profile: {
        real_name: e.profile.real_name,
        phone: e.profile.phone,
        image_32: e.profile.image_32,
        first_name: e.profile.first_name,
        last_name: e.profile.last_name
      },
      is_app_user: e.is_app_user,
      is_bot: e.is_bot,
      deleted: e.deleted
    }))
  }

  return { members, response_metadata: result.data.response_metadata }
}


export const fetchChannelMembers = async function (slackToken: string, channelId: string) {
  const result: AxiosResponse<{ ok: boolean, members: string[], response_metadata: { next_cursor: '' } }> = await axios.get(`https://slack.com/api/conversations.members?channel=${channelId}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slackToken}`
    }
  })

  if (result.data.ok) {
    return result.data.members
  }
  return []
}

export const fetchSlackUserProfile = async function (slackToken: string, slackId: string) {
  const result: AxiosResponse<{ ok: boolean, user: SlackUser }> = await axios.get(`https://slack.com/api/users.info?user=${slackId}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slackToken}`
    }
  })

  if (result.data.ok) {
    return result.data.user
  }
  return null
}



// messaging

// create conversation
export const createConversation = async function (slackToken: string, slackId: string) {
  const result: AxiosResponse<{ ok: boolean, channel: { id: string } }> = await axios.post(`https://slack.com/api/conversations.open`, {
    users: slackId
  }, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slackToken}`
    }
  })

  if (!result.data.ok) {
    return null
  }

  return result.data.channel.id
}

// send message
export const sendSlackMessage = async function (slackToken: string, channelId: string, content: SlackMessage) {
  const result: AxiosResponse<{ ok: boolean, user: SlackUser }> = await axios.post(`https://slack.com/api/chat.postMessage`, {
    channel: channelId,
    ...content
  }, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slackToken}`
    }
  })

  if (!result.data.ok) {
    console.log(result.data)
    throw new Error("Could not send this message")
  }
}


// send message
export const sendSlackModalMessage = async function (slackToken: string, trigger: string, content: SlackMessage) {
  console.log(trigger)
  const result: AxiosResponse<{ ok: boolean, }> = await axios.post(`https://slack.com/api/views.open`, {
    trigger_id: trigger,
    view: content
  }, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slackToken}`
    }
  })

  if (!result.data.ok) {
    console.log(result.data)
    throw new Error("Could not send this message")
  }
}

export const sendSlackResponseMessage = async function (url: string, content: SlackMessage) {
  const result: AxiosResponse<{ ok: boolean, user: SlackUser }> = await axios.post(url, {
    ...content,
    "replace_original": false,
    "response_type": "in_channel"
  }, {
    headers: {
      "Content-Type": "application/json",
    }
  })

  if (!result.data.ok) {
    console.log(result.data)
    throw new Error("Could not send this message")
  }
}


export const sendWelcomeSlack = async (currentIndex: string, slackId: string, token: string, messageId: string): Promise<void> => {
  try {
    if (redisClient.isReady) {
      const courseKey = `${config.redisBaseKey}courses:${currentIndex}`
      const courseFlow = await redisClient.get(courseKey)
      if (courseFlow) {
        const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
        const item = courseFlowData[0]
        if (item) {

          const user = await fetchSlackUserProfile(token, slackId)
          const conversation = await createConversation(token, slackId)
          if (conversation && user) {
            agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
              channel: conversation,
              accessToken: token,
              message: {
                blocks: [
                  {
                    type: MessageBlockType.SECTION,
                    text: {
                      type: SlackTextMessageTypes.MARKDOWN,
                      text: `Welcome *${user.profile.first_name}*\n\n${item.content}`

                    }
                  },
                  {
                    type: MessageBlockType.ACTIONS,
                    elements: [
                      {
                        type: SlackActionType.BUTTON,
                        style: MessageActionButtonStyle.PRIMARY,
                        text: {
                          type: SlackTextMessageTypes.PLAINTEXT,
                          "emoji": true,
                          text: "Start",
                        },
                        value: CONTINUE + `|${messageId}`
                      }
                    ]
                  }
                ]
              }
            })
          }
        }
      }
    }
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

export async function fetchEnrollmentsSlack (channel: string): Promise<CourseEnrollment[]> {
  const enrollments: CourseEnrollment[] = []
  if (redisClient.isReady) {
    const pattern = `${config.redisBaseKey}enrollments:slack:${channel}:*`
    const { keys } = await redisClient.scan(0, {
      COUNT: 100,
      MATCH: pattern
    })
    for (let key of keys) {
      const dt = await redisClient.get(key)
      if (dt) {
        enrollments.push(JSON.parse(dt))
      }
    }
  }
  return enrollments
}

export const startCourseSlack = async (channel: string, courseId: string, studentId: string, token: string): Promise<string> => {
  const course: CourseInterface | null = await Courses.findById(courseId)
  const key = `${config.redisBaseKey}enrollments:slack:${channel}:${courseId}`
  const initialMessageId = v4()
  if (course) {
    if (redisClient.isReady) {
      const courseKey = `${config.redisBaseKey}courses:${courseId}`
      const courseFlow = await redisClient.get(courseKey)
      if (courseFlow) {
        const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
        const redisData: CourseEnrollment = {
          team: course.owner,
          student: studentId,
          id: courseId,
          lastMessageId: initialMessageId,
          title: course.title,
          description: convertToWhatsAppString(he.decode(course.description)),
          active: true,
          quizAttempts: 0,
          progress: 0,
          currentBlock: 0,
          nextBlock: 1,
          totalBlocks: courseFlowData.length,
          slackToken: token
        }
        let enrollments: CourseEnrollment[] = await fetchEnrollmentsSlack(channel)
        let active: CourseEnrollment[] = enrollments.filter(e => e.active)
        if (active.length > 0) {
          // mark it as not active
          for (let act of active) {
            let copy = { ...act }
            copy.active = false
            const keyOld = `${config.redisBaseKey}enrollments:slack:${channel}:${act.id}`
            await redisClient.set(keyOld, JSON.stringify(copy))
          }
        }
        await redisClient.set(key, JSON.stringify(redisData))
      }
    }
  }
  return initialMessageId
}


export const enrollStudentToCourseSlack = async (studentId: string, courseId: string): Promise<void> => {
  const student = await Students.findOne({ _id: studentId })
  if (!student) {
    return
  }
  if (!student.verified) {
    return
  }

  // enroll course
  const course = await Courses.findById(courseId)
  if (!course) {
    return
  }
  const owner = await Teams.findById(course.owner)
  if (!owner || !owner.slackToken) {
    return
  }
  await generateCourseFlow(courseId)
  const id = await startCourseSlack(student.channelId, courseId, student.id, owner.slackToken)
  await sendWelcomeSlack(courseId, student.slackId, owner.slackToken, id)

  let dbRef = db.ref(COURSE_STATS).child(course.owner).child(courseId)
  await dbRef.child("students").child(studentId).set({
    name: student.firstName + ' ' + student.otherNames,
    phoneNumber: student.phoneNumber,
    studentId,
    progress: 0,
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




export const sendBlockContent = async (data: CourseFlowItem, url: string, messageId: string): Promise<void> => {
  try {
    let buttons: SlackActionBlock[] = []
    if (data.type === CourseFlowMessageType.BLOCK) {
      buttons.push({
        type: SlackActionType.BUTTON,
        style: MessageActionButtonStyle.PRIMARY,
        text: {
          text: "Continue",
          type: SlackTextMessageTypes.PLAINTEXT,
          emoji: true
        },
        value: CONTINUE + `|${messageId}`
      })
    } else {
      buttons = [
        {
          type: SlackActionType.BUTTON,
          style: MessageActionButtonStyle.PRIMARY,
          text: {
            text: "Yes",
            type: SlackTextMessageTypes.PLAINTEXT,
            emoji: true
          },
          value: QUIZ_YES + `|${messageId}`
        },
        {
          type: SlackActionType.BUTTON,
          style: MessageActionButtonStyle.PRIMARY,
          text: {
            text: "No",
            type: SlackTextMessageTypes.PLAINTEXT,
            emoji: true
          },
          value: QUIZ_NO + `|${messageId}`,
        }
      ]
    }

    let blocks: SlackMessageBlock[] = []

    if (data.mediaUrl) {
      blocks.push({
        type: MessageBlockType.IMAGE,
        image_url: data.mediaUrl || '',
        alt_text: 'Block header image'
      })
    }


    blocks.push({
      type: MessageBlockType.SECTION,
      text: {
        type: SlackTextMessageTypes.MARKDOWN,
        text: data.content
      }
    }, {
      type: MessageBlockType.ACTIONS,
      elements: buttons
    })

    agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
      url,
      message: {
        blocks
      }
    })


    // update the blockStartTime
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}



export const sendQuiz = async (item: CourseFlowItem, url: string, messageId: string): Promise<void> => {
  try {
    let buttons: SlackActionBlock[] = [
      {
        type: SlackActionType.BUTTON,
        style: MessageActionButtonStyle.PRIMARY,
        text: {
          text: "A",
          type: SlackTextMessageTypes.PLAINTEXT,
          emoji: true
        },
        value: QUIZ_A + `|${messageId}`
      },
      {
        type: SlackActionType.BUTTON,
        style: MessageActionButtonStyle.PRIMARY,
        text: {
          text: "B",
          type: SlackTextMessageTypes.PLAINTEXT,
          emoji: true
        },
        value: QUIZ_B + `|${messageId}`,
      },
      {
        type: SlackActionType.BUTTON,
        style: MessageActionButtonStyle.PRIMARY,
        text: {
          text: "C",
          type: SlackTextMessageTypes.PLAINTEXT,
          emoji: true
        },
        value: QUIZ_C + `|${messageId}`,
      }
    ]

    let blocks: SlackMessageBlock[] = []


    blocks.push({
      type: MessageBlockType.SECTION,
      text: {
        type: SlackTextMessageTypes.MARKDOWN,
        text: item.content
      },
    }, {
      type: MessageBlockType.ACTIONS,
      elements: buttons
    })


    agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
      url,
      message: {
        blocks
      }
    })
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}



export const handleContinueSlack = async (nextIndex: number, courseKey: string, channel: string, url: string, messageId: string, data: CourseEnrollment): Promise<void> => {
  const flow = await redisClient.get(courseKey)
  if (flow) {
    const flowData: CourseFlowItem[] = JSON.parse(flow)
    const currentItem = flowData[nextIndex - 1]
    if (currentItem && currentItem.type === CourseFlowMessageType.BLOCK) {
      // calculate the elapsed time and update stats service
    }
    let item = flowData[nextIndex]
    if (item) {
      const key = `${config.redisBaseKey}enrollments:slack:${channel}:${data?.id}`
      if (data) {
        let updatedData: CourseEnrollment = { ...data, lastMessageId: messageId, currentBlock: data.currentBlock + 1, nextBlock: data.nextBlock + 1 }
        let currentItem = flowData[data.currentBlock]
        if (currentItem && (currentItem.type === CourseFlowMessageType.BLOCK || currentItem.type === CourseFlowMessageType.BLOCKWITHQUIZ)) {
          // calculate the elapsed time and update stats service
          if (data.blockStartTime) {
            const diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
            saveBlockDuration(data.team, data.student, diffInSeconds, currentItem.lesson, currentItem.block)
            updatedData = { ...updatedData, blockStartTime: null }
          }
        }


        switch (item.type) {
          case CourseFlowMessageType.STARTQUIZ:
            agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
              url,
              message: {
                blocks: [
                  {
                    type: MessageBlockType.SECTION,
                    text: {
                      type: SlackTextMessageTypes.MARKDOWN,
                      text: item.content
                    },
                  },
                  {
                    type: MessageBlockType.ACTIONS,
                    elements: [
                      {
                        type: SlackActionType.BUTTON,
                        value: CONTINUE + `|${messageId}`,
                        text: {
                          type: SlackTextMessageTypes.PLAINTEXT,
                          emoji: true,
                          text: "Continue"
                        },
                        style: MessageActionButtonStyle.PRIMARY
                      }
                    ]
                  }
                ]
              }
            })
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.ENDQUIZ:
            const progress = (data.currentBlock / data.totalBlocks) * 100
            let score = '0'
            let currentItem = flowData[data.currentBlock]
            if (currentItem && currentItem.quiz && data.lessons) {
              let scores = data.lessons[currentItem.quiz.lesson]?.scores
              if (scores) {
                score = ((scores.reduce((a, b) => a + b, 0) / scores.length) * 100).toFixed(0)
              }
            }
            const dbRef = db.ref(COURSE_STATS).child(data.team).child(data.id).child("students")
            // get existing data
            const snapshot = await dbRef.once('value')
            let rtdb: { [id: string]: StudentCourseStats } | null = snapshot.val()
            let rankings: StudentCourseStats[] = []
            if (rtdb) {
              let stds: StudentCourseStats[] = Object.values(rtdb)
              if (stds.length > 1) {
                rankings = stds.sort((a: StudentCourseStats, b: StudentCourseStats) => {
                  const first = a.scores ? a.scores.reduce((a, b) => a + b, 0) : 0
                  const second = b.scores ? b.scores.reduce((a, b) => a + b, 0) : 0
                  return second - first
                })
              } else {
                rankings = stds
              }
            }
            const rank = rankings.findIndex(e => e.studentId === data.student)
            agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
              url,
              message: {
                blocks: [
                  {
                    type: MessageBlockType.SECTION,
                    text: {
                      type: SlackTextMessageTypes.MARKDOWN,
                      text: item.content.replace('{progress}', Math.ceil(progress).toString()).replace('{score}', score).replace('{course_rank}', (rank >= 0 ? rank + 1 : 1).toString())
                    }
                  }
                ]
              }
            })
            await delay(10000)
            agenda.now<CourseEnrollment>(SEND_LEADERBOARD_SLACK, {
              ...updatedData,
              slackResponseUrl: url
            })
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.ENDCOURSE:
            let blocks: SlackMessageBlock[] = [

            ]

            let next = flowData[nextIndex + 1]
            if (next?.surveyId && next.surveyQuestion) {
              blocks = [
                {
                  type: MessageBlockType.SECTION,
                  text: {
                    type: SlackTextMessageTypes.MARKDOWN,
                    text: item.content.replace('{survey}', `\n\nClick the following button to take the survey.`)
                  },
                },
                {
                  type: MessageBlockType.ACTIONS,
                  elements: [
                    {
                      type: SlackActionType.BUTTON,
                      value: `start-survey|${messageId}`,
                      text: {
                        type: SlackTextMessageTypes.PLAINTEXT,
                        emoji: true,
                        text: "Begin survey"
                      },
                      style: MessageActionButtonStyle.DANGER
                    }
                  ]
                }
              ]
            } else {
              blocks = [
                {
                  type: MessageBlockType.SECTION,
                  text: {
                    type: SlackTextMessageTypes.MARKDOWN,
                    text: item.content.replace('{survey}', '')
                  }
                }
              ]
              // if no survey for this course, then send the certificate
              await delay(5000)
              agenda.now<CourseEnrollment>(SEND_CERTIFICATE_SLACK, {
                ...updatedData,
                slackResponseUrl: url
              })

            }

            agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
              url,
              message: {
                blocks
              }
            })

            break
          case CourseFlowMessageType.ENDLESSON:
            agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
              url,
              message: {
                blocks: [
                  {
                    type: MessageBlockType.SECTION,
                    text:
                    {
                      type: SlackTextMessageTypes.MARKDOWN,
                      text: item.content
                    },
                  },
                  {
                    type: MessageBlockType.ACTIONS,
                    elements: [
                      {
                        type: SlackActionType.BUTTON,
                        value: CONTINUE + `|${messageId}`,
                        text: {
                          type: SlackTextMessageTypes.PLAINTEXT,
                          emoji: true,
                          text: "Continue Now"
                        },
                        style: MessageActionButtonStyle.PRIMARY
                      },
                      {
                        type: SlackActionType.BUTTON,
                        value: TOMORROW + `|${messageId}`,
                        text: {
                          type: SlackTextMessageTypes.PLAINTEXT,
                          emoji: true,
                          text: "Continue Tomorrow"
                        },
                        style: MessageActionButtonStyle.PRIMARY
                      },
                      {
                        type: SlackActionType.BUTTON,
                        value: SCHEDULE_RESUMPTION + `|${messageId}`,
                        text: {
                          type: SlackTextMessageTypes.PLAINTEXT,
                          emoji: true,
                          text: "Set resumption time"
                        },
                        style: MessageActionButtonStyle.DANGER
                      }
                    ]
                  }
                ]
              }
            })
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.QUIZ:
            await sendQuiz(item, url, messageId)
            updatedData = { ...updatedData, quizAttempts: 0, blockStartTime: new Date() }
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.INTRO:
            agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
              url,
              message: {
                blocks: [
                  {
                    type: MessageBlockType.IMAGE,
                    image_url: item.mediaUrl || '',
                    alt_text: 'Course header image'
                  },
                  {
                    type: MessageBlockType.SECTION,
                    text: {
                      type: SlackTextMessageTypes.MARKDOWN,
                      text: item.content
                    },
                  },
                  {
                    type: MessageBlockType.ACTIONS,
                    elements: [
                      {
                        type: SlackActionType.BUTTON,
                        value: CONTINUE + `|${messageId}`,
                        text: {
                          type: SlackTextMessageTypes.PLAINTEXT,
                          emoji: true,
                          text: "Continue"
                        },
                        style: MessageActionButtonStyle.PRIMARY
                      }
                    ]
                  }
                ]
              }
            })
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.BLOCK:
          case CourseFlowMessageType.BLOCKWITHQUIZ:
            await sendBlockContent(item, url, messageId)
            updatedData = { ...updatedData, blockStartTime: new Date() }
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break

          case CourseFlowMessageType.END_SURVEY:
            agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
              url,
              message: {
                blocks: [
                  {
                    type: MessageBlockType.SECTION,
                    text: {
                      type: SlackTextMessageTypes.MARKDOWN,
                      text: item.content
                    }

                  }
                ]
              }
            })
            await delay(5000)
            agenda.now<CourseEnrollment>(SEND_CERTIFICATE_SLACK, {
              ...updatedData,
              slackResponseUrl: url
            })
            break
          default:
            break
        }
        redisClient.set(key, JSON.stringify({ ...updatedData }))
      }
    }
  }
}

export const handleSendSurveySlack = async (courseKey: string, data: CourseEnrollment, trigger_id: string): Promise<void> => {
  const flow = await redisClient.get(courseKey)

  if (flow && data.slackToken) {
    const flowData: CourseFlowItem[] = JSON.parse(flow)
    const surveyItems = flowData.filter(e => e.surveyId)
    let payload: SendSlackModalPayload = {
      trigger_id,
      token: data.slackToken,
      view: {
        "type": "modal",
        callback_id: `survey|${data.student}`,
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
              "text": `:wave: We'd love to hear from you how we can make this place the best place you’ve ever worked.`,
              "emoji": true
            }
          },
          {
            "type": MessageBlockType.DIVIDER
          }
        ]
      }
    }
    const choices = [SURVEY_A, SURVEY_B, SURVEY_C]
    for (let item of surveyItems) {
      if (payload.view.callback_id) {
        payload.view.callback_id = `survey=${item.surveyId}|course=${data.id}|student=${data.student}|team=${data.team}`
      }
      if (item.surveyQuestion?.responseType === ResponseType.MULTI_CHOICE && payload.view && payload.view.blocks) {
        payload.view.blocks.push({
          "type": MessageBlockType.INPUT,
          "block_id": item.surveyQuestion.id,
          "label": {
            "type": SlackTextMessageTypes.PLAINTEXT,
            "text": item.surveyQuestion.question,
            "emoji": true
          },
          "element": {
            "type": SlackActionType.SELECT,
            "action_id": `${item.surveyQuestion.id}_value`,
            "placeholder": {
              "type": SlackTextMessageTypes.PLAINTEXT,
              "text": "Select your response",
              "emoji": true
            },
            "options": [
              ...item.surveyQuestion.choices.map((choice, index) => ({
                "text": {
                  "type": SlackTextMessageTypes.PLAINTEXT,
                  "text": choice,
                  "emoji": true
                },
                "value": choices[index] || ''
              })),
            ]
          }
        })
      }

      if (item.surveyQuestion?.responseType === ResponseType.FREE_FORM && payload.view && payload.view.blocks) {
        payload.view.blocks.push({
          "type": MessageBlockType.INPUT,
          "block_id": item.surveyQuestion.id,
          "label": {
            "type": SlackTextMessageTypes.PLAINTEXT,
            "text": item.surveyQuestion.question,
            "emoji": true
          },
          "element": {
            "type": SlackActionType.TEXTINPUT,
            "multiline": true,
            "action_id": `${item.surveyQuestion.id}_value`,
          }
        })
      }
    }
    agenda.now<SendSlackModalPayload>(SEND_SLACK_MODAL, payload)
  }
}

export const handleBlockQuiz = async (answer: string, data: CourseEnrollment, url: string, messageId: string, channel: string): Promise<void> => {
  const courseKey = `${config.redisBaseKey}courses:${data.id}`
  const courseFlow = await redisClient.get(courseKey)
  let updatedData = { ...data, lastMessageId: messageId }
  if (courseFlow) {
    const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
    const item = courseFlowData[data.currentBlock]
    let payload: SlackTextMessage = {
      type: SlackTextMessageTypes.MARKDOWN,
      text: ``
    }
    if (item && item.quiz) {
      let correctAnswer = item.quiz.choices[item.quiz.correctAnswerIndex]
      if (correctAnswer === answer) {
        // send correct answer context
        payload.text = `That is correct!. ${convertToWhatsAppString(he.decode(item.quiz.correctAnswerContext))}`
      } else {
        // send wrong answer context
        payload.text = `That is incorrect!. ${convertToWhatsAppString(he.decode(item.quiz.wrongAnswerContext))}`
      }
      // calculate the elapsed time and update stats service
      if (data.blockStartTime) {
        const diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
        saveBlockDuration(data.team, data.student, diffInSeconds, item.lesson, item.block)
        updatedData = { ...updatedData, blockStartTime: null }
      }
      agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
        url,
        message: {
          blocks: [
            {
              type: MessageBlockType.SECTION,
              text: payload,
            },
            {
              type: MessageBlockType.ACTIONS,
              elements: [
                {
                  "type": SlackActionType.BUTTON,
                  "text": {
                    "type": SlackTextMessageTypes.PLAINTEXT,
                    "text": "Continue",
                    "emoji": true
                  },
                  "value": CONTINUE + `|${messageId}`,
                  style: MessageActionButtonStyle.PRIMARY
                }
              ]
            }
          ]
        }
      })
    }

  }
  const key = `${config.redisBaseKey}enrollments:slack:${channel}:${data?.id}`
  redisClient.set(key, JSON.stringify({ ...updatedData }))
}

export const handleLessonQuiz = async (answer: number, data: CourseEnrollment, url: string, messageId: string, channel: string): Promise<void> => {
  const courseKey = `${config.redisBaseKey}courses:${data.id}`
  const courseFlow = await redisClient.get(courseKey)
  if (courseFlow) {
    const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
    const item = courseFlowData[data.currentBlock]
    let payload: SlackTextMessage = {
      type: SlackTextMessageTypes.MARKDOWN,
      text: ``
    }
    let elements: SlackActionBlock[] = [
      {
        "type": SlackActionType.BUTTON,
        "text": {
          "type": SlackTextMessageTypes.PLAINTEXT,
          "text": "Continue",
          "emoji": true
        },
        "value": CONTINUE + `|${messageId}`,
        style: MessageActionButtonStyle.PRIMARY
      }
    ]
    if (item && item.quiz) {
      const key = `${config.redisBaseKey}enrollments:slack:${channel}:${data.id}`
      let updatedData: CourseEnrollment = { ...data, lastMessageId: messageId }
      let duration = 0, retakes = 0, saveStats = false, score = 0
      if (item.quiz.correctAnswerIndex === answer) {
        // send correct answer context
        payload.text = `That is correct!. ${convertToWhatsAppString(he.decode(item.quiz.correctAnswerContext))}`
        // update stats(retakes and duration)
        retakes = data.quizAttempts
        saveStats = true
        if (data.blockStartTime) {
          const diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
          duration = diffInSeconds
          updatedData = { ...updatedData, blockStartTime: null }
        }
        score = 1
        // compute the score
      } else {
        // update quizAttempts
        updatedData.quizAttempts = data.quizAttempts + 1
        let textBody = `Not quite right!. \n\n${convertToWhatsAppString(he.decode(item.quiz.revisitChunk))}. \n\n`
        if (data.quizAttempts === 0) {
          textBody = `Not quite right!. \n\nHint: ${convertToWhatsAppString(he.decode(item.quiz.hint || ''))}. \n\nPlease try again: \n\n${item.content}`
          if (item.quiz.hint && item.quiz.hint.length < 2) {
            textBody = `Not quite right!.\n\nPlease try again: \n\n${item.content}`
          }
          elements = [
            {
              type: SlackActionType.BUTTON,
              style: MessageActionButtonStyle.PRIMARY,
              text: {
                text: "A",
                type: SlackTextMessageTypes.PLAINTEXT,
                emoji: true
              },
              value: QUIZ_A + `|${messageId}`
            },
            {
              type: SlackActionType.BUTTON,
              style: MessageActionButtonStyle.PRIMARY,
              text: {
                text: "B",
                type: SlackTextMessageTypes.PLAINTEXT,
                emoji: true
              },
              value: QUIZ_B + `|${messageId}`,
            },
            {
              type: SlackActionType.BUTTON,
              style: MessageActionButtonStyle.PRIMARY,
              text: {
                text: "C",
                type: SlackTextMessageTypes.PLAINTEXT,
                emoji: true
              },
              value: QUIZ_C + `|${messageId}`,
            }
          ]
        } else {
          retakes = updatedData.quizAttempts
          saveStats = true
          if (data.blockStartTime) {
            const diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
            duration = diffInSeconds
            updatedData = { ...updatedData, blockStartTime: null }
          }
          score = 0
          // compute the score
        }
        // send wrong answer context
        payload.text = textBody
      }
      if (!updatedData.lessons) {
        updatedData.lessons = {
          [item.quiz.lesson]: {
            scores: [score]
          }
        }
      } else if (updatedData.lessons && (!updatedData.lessons[item.quiz.lesson] || !updatedData.lessons[item.quiz.lesson]?.scores)) {
        updatedData.lessons[item.quiz.lesson] = {
          scores: [score]
        }
      } else if (data.lessons && data.lessons[item.quiz.lesson] && updatedData.lessons[item.quiz.lesson]?.scores) {
        let lessonNode = data.lessons[item.quiz.lesson]
        if (lessonNode) {
          lessonNode.scores.push(score)
        }
      }
      await redisClient.set(key, JSON.stringify(updatedData))
      if (saveStats) {
        saveQuizDuration(data.team, data.student, duration, score, retakes, item.lesson, item.quiz)
      }
      agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
        url,
        message: {
          blocks: [
            {
              type: MessageBlockType.SECTION,
              text: payload,
            },
            {
              type: MessageBlockType.ACTIONS,
              elements
            }
          ]
        }
      })
    }
  }
}

export const handleSurvey = async (answer: number, data: CourseEnrollment, surveyId: string, questionId: string, multi: boolean, response: string): Promise<void> => {
  const survey = await Surveys.findById(surveyId)
  if (survey) {
    let current = survey.questions.find(e => e.id === questionId)
    if (current) {
      await SurveyResponse.create({
        survey: surveyId,
        team: data.team,
        surveyQuestion: current.id,
        course: data.id,
        student: data.student,
        response: multi ? current.choices[answer] : response,
        responseType: multi ? ResponseType.MULTI_CHOICE : ResponseType.FREE_FORM
      })
    }
  }
}

export const sendResumptionOptions = async (url: string, key: string, data: CourseEnrollment): Promise<void> => {
  try {
    let msgId = v4()
    agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
      url,
      message: {
        blocks: [
          {
            type: MessageBlockType.SECTION,
            text: {
              type: SlackTextMessageTypes.MARKDOWN,
              text: `You have chosen to resume this course tomorrow. \n\nSelect a time tomorrow to resume this course.\n\n\n*Morning*: Resume at 9am tomorrown\n*Afternoon*: Resume at 3pm tomorrown\n*Evening*: Resume at 8pm tomorrow`
            },
          },
          {
            type: MessageBlockType.ACTIONS,
            elements: [
              {
                "type": SlackActionType.BUTTON,
                "text": {
                  "type": SlackTextMessageTypes.PLAINTEXT,
                  "text": "Morning",
                  "emoji": true
                },
                "value": MORNING + `|${msgId}`,
                style: MessageActionButtonStyle.PRIMARY
              },
              {
                "type": SlackActionType.BUTTON,
                "text": {
                  "type": SlackTextMessageTypes.PLAINTEXT,
                  "text": "Afternoon",
                  "emoji": true
                },
                "value": AFTERNOON + `|${msgId}`,
                style: MessageActionButtonStyle.PRIMARY
              },
              {
                "type": SlackActionType.BUTTON,
                "text": {
                  "type": SlackTextMessageTypes.PLAINTEXT,
                  "text": "Evening",
                  "emoji": true
                },
                "value": EVENING + `|${msgId}`,
                style: MessageActionButtonStyle.PRIMARY
              }
            ]
          }
        ]
      }
    })
    await redisClient.set(key, JSON.stringify({ ...data, lastMessageId: msgId }))
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}


export const sendResumptionMessageSlack = async (channelId: string, key: string, data: CourseEnrollment): Promise<void> => {
  try {
    let msgId = v4()
    agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
      channel: channelId,
      accessToken: data.slackToken || "",
      message: {
        blocks: [
          {
            type: MessageBlockType.SECTION,
            text: {
              type: SlackTextMessageTypes.MARKDOWN,
              text: `You scheduled to resume the course *${data.title} today at this time.*\n\nYou can resume your scheduled course by clicking the "Resume now" button below`
            },
          },
          {
            type: MessageBlockType.ACTIONS,
            elements: [
              {
                "type": SlackActionType.BUTTON,
                "text": {
                  "type": SlackTextMessageTypes.PLAINTEXT,
                  "text": "Resume now",
                  "emoji": true
                },
                "value": RESUME_COURSE + `|${msgId}`,
                style: MessageActionButtonStyle.PRIMARY
              }
            ]
          }
        ]
      }
    })
    await redisClient.set(key, JSON.stringify({ ...data, lastMessageId: msgId }))
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

export const sendScheduleAcknowledgement = async (url: string, time: string): Promise<void> => {
  try {
    agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
      url,
      message: {
        blocks: [
          {
            type: MessageBlockType.SECTION,
            text: {
              type: SlackTextMessageTypes.MARKDOWN,
              text: `You have chosen to resume this course at ${time} tomorrow. \n\nWe will continue this course for you at this time.`
            }
          }
        ]
      }
    })
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

import axios, { AxiosResponse } from 'axios'
import config from '../../config/config'
import { teamService } from '../teams'
import { redisClient } from '../redis'
import { ApiError } from '../errors'
import httpStatus from 'http-status'
import he from "he"
import db from "../rtdb"
import { MessageActionButtonStyle, MessageBlockType, SendSlackMessagePayload, SlackActionType, SlackChannel, SlackMessage, SlackTextMessageTypes, SlackUser } from './interfaces.slack'
import { CourseFlowItem, convertToWhatsAppString, generateCourseFlow } from '../webhooks/service.webhooks'
import { agenda } from '../scheduler'
import { GENERATE_COURSE_TRENDS, SEND_SLACK_MESSAGE } from '../scheduler/MessageTypes'
import { CourseInterface } from '../courses/interfaces.courses'
import Courses from '../courses/model.courses'
import { v4 } from 'uuid'
import { CONTINUE, CourseEnrollment } from '../webhooks/interfaces.webhooks'
import Students from '../students/model.students'
import { Course } from '../courses'
import Teams from '../teams/model.teams'
import { COURSE_STATS } from '../rtdb/nodes'

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
                    fields: [
                      {
                        type: SlackTextMessageTypes.MARKDOWN,
                        text: `Welcome *${user.profile.first_name}*\n\n${item.content}`

                      }
                    ]
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

export const startCourseSlack = async (channel: string, courseId: string, studentId: string): Promise<string> => {
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
          totalBlocks: courseFlowData.length
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
    throw new ApiError(httpStatus.NOT_FOUND, "No student account found.")
  }
  if (!student.verified) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Student account has not been verified.")
  }

  // enroll course
  const course = await Course.findById(courseId)
  if (!course) {
    throw new ApiError(httpStatus.NOT_FOUND, "No course found for this id.")
  }
  const owner = await Teams.findById(course.owner)
  if (!owner) {
    throw new ApiError(httpStatus.NOT_FOUND, "No team found.")
  }
  await generateCourseFlow(courseId)
  const id = await startCourseSlack(student.channelId, courseId, student.id)
  await sendWelcomeSlack(courseId, student.slackId, owner.slackToken, id)

  let dbRef = db.ref(COURSE_STATS).child(course.owner).child(courseId)
  await dbRef.child("students").child(studentId).set({
    name: student.firstName + ' ' + student.otherNames,
    phoneNumber: student.phoneNumber,
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
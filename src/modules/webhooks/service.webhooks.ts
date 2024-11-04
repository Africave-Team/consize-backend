import httpStatus from 'http-status'
import ApiError from '../errors/ApiError'
import { BlockInterface } from '../courses/interfaces.blocks'
import { QuizInterface } from '../courses/interfaces.quizzes'
import { AFTERNOON, CONTINUE, CourseEnrollment, EVENING, InteractiveMessage, MORNING, Message, QUIZ_A, QUIZ_B, QUIZ_C, QUIZA_A, QUIZA_B, QUIZA_C, QUIZ_NO, QUIZ_YES, RESUME_COURSE_TOMORROW, ReplyButton, SCHEDULE_RESUMPTION, START, SURVEY_A, SURVEY_B, SURVEY_C, TOMORROW } from './interfaces.webhooks'
import axios, { AxiosError, AxiosResponse } from 'axios'
import config from '../../config/config'
import { redisClient } from '../redis'
import Courses from '../courses/model.courses'
import { Team, teamService } from '../teams'
import { CourseInterface, CourseStatus, MediaType } from '../courses/interfaces.courses'
import he from "he"
import * as cheerio from "cheerio"
import db from "../rtdb"
import Settings from '../courses/model.settings'
import Lessons from '../courses/model.lessons'
import Blocks from '../courses/model.blocks'
import Quizzes from '../courses/model.quizzes'
import { agenda } from '../scheduler'
import { DAILY_ROUTINE, DELAYED_FACEBOOK_INTEGRATION, INACTIVITY_REMINDER, INACTIVITY_REMINDER_SHORT, RESUME_TOMORROW, SEND_CERTIFICATE, SEND_LEADERBOARD, SEND_SLACK_MESSAGE, SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { v4 } from 'uuid'
import { logger } from '../logger'
import moment from 'moment-timezone'
import { LessonInterface } from '../courses/interfaces.lessons'
import { saveBlockDuration, saveCourseProgress, saveQuizDuration } from '../students/students.service'
import { delay, generateVideoThumbnail } from '../generators/generator.service'
import { Survey, SurveyResponse } from '../surveys'
import { Question, ResponseType } from '../surveys/survey.interfaces'
import { COURSE_STATS } from '../rtdb/nodes'
import { StudentCourseStats, StudentInterface } from '../students/interface.students'
import { MessageActionButtonStyle, MessageBlockType, SendSlackMessagePayload, SlackActionType, SlackTextMessageTypes } from '../slack/interfaces.slack'
import Students from '../students/model.students'
import { FacebookIntegrationData, TeamsInterface } from '../teams/interfaces.teams'
import { studentService } from '../students'
import Subscriptions from '../subscriptions/subscriptions.models'
import QuestionGroup from '../courses/model.question-group'
import { QuestionGroupsInterface } from '../courses/interfaces.question-group'
// import Teams from '../teams/model.teams'
// import { convertTo24Hour } from '../utils'
// import { convertTo24Hour } from '../utils'
// const INACTIVITY_TIME = 5
// import randomstring from "randomstring"

export enum CourseFlowMessageType {
  WELCOME = 'welcome',
  INTRO = 'intro',
  BLOCK = 'block',
  ENDLESSON = 'end-of-lesson',
  STARTQUIZ = 'start-of-quiz',
  ENDQUIZ = 'end-of-quiz',
  ENDCOURSE = 'end-of-course',
  BLOCKWITHQUIZ = 'block-with-quiz',
  QUIZ = 'quiz',
  LEADERBOARD = 'leaderboard',
  CERTIFICATE = 'certificate',
  SURVEY_MULTI_CHOICE = 'survey-multi-choice',
  SURVEY_FREE_FORM = 'survey-free-form',
  START_SURVEY = "start-survey",
  END_SURVEY = 'end-survey',
  END_OF_BUNDLE = 'end-of-bundle',
  STARTASSESSMENT = 'start-of-assessment',
  ENDASSESSMENT = 'end-of-assessment',
  ASSESSMENT = 'assessment'
}

export interface CourseFlowItem {
  type: CourseFlowMessageType
  content: string
  mediaType?: MediaType
  mediaUrl?: string
  mediaUrlEmbed?: string
  thumbnailUrl?: string
  block?: BlockInterface
  lesson?: LessonInterface
  quiz?: QuizInterface
  surveyQuestion?: Question
  surveyId?: string
  assessment?: QuizInterface
  questionGroup?: QuestionGroupsInterface
  assessmentId?: string
}

// interface UserTracker {
//   courseId: string
//   currentIndex: number
//   currentType: CourseFlowMessageType
// }

function formatText (html: string, indent: number) {
  let formattedText = html
  formattedText = formattedText.replace(/\s+([^\s]+)="/gi, ' $1=')
  // formattedText = formattedText.replace(/\n/g, '')
  // Replace <br /> tags with new lines
  // formattedText = formattedText.replace(/<p(?:\s+[^>]*?)?>(.*?)<\/p>/gi, '')
  formattedText = formattedText.replace(/<p(?:\s+[^>]*?)?>(.*?)<\/p>/gi, '$1')
  formattedText = formattedText.replace(/<p>(.*?)<\/p>/gi, '$1')


  // Replace <b> tags with *
  formattedText = formattedText.replace(/<b>(.*?)<\/b>/gi, (_, p1) => {
    return p1.trim().endsWith(' ') ? `*${p1.trim()}* ` : `*${p1.trim()}* `
  })
  formattedText = formattedText.replace(/<strong>(.*?)<\/strong>/gi, (_, p1) => {
    return p1.trim().endsWith(' ') ? `*${p1.trim()}* ` : `*${p1.trim()}* `
  })

  // Replace <i> and <em> tags with _
  formattedText = formattedText.replace(/<i>(.*?)<\/i>/gi, (_, p1) => {
    return p1.trim().endsWith(' ') ? `_${p1.trim()}_ ` : `_${p1.trim()}_ `
  })
  formattedText = formattedText.replace(/<em>(.*?)<\/em>/gi, (_, p1) => {
    return p1.trim().endsWith(' ') ? `_${p1.trim()}_ ` : `_${p1.trim()}_ `
  })


  formattedText = formattedText.replace(/\s{2,}/g, ' ')
  // Handle lists
  // Replace <ul> and <ol> tags with new lines
  formattedText = formattedText.replace(/<\/?ul.*?>/gi, '')
  formattedText = formattedText.replace(/<\/?ol.*?>/gi, '')
  let count = 0

  // Replace <li> tags with "-" for unordered lists and numbers for ordered lists
  formattedText = formattedText.replace(/<li(?:\s+[^>]*?)?>(.*?)<\/li>/gi, (_, content) => {
    const indentation = ' '.repeat(indent * 4)
    if (html.includes('<ol>')) {
      count = count + 1
      return `${indentation}${count}. ${formatText(content, indent + 1)}`
    }
    return `${indentation}- ${formatText(content, indent + 1)}`
  })

  // Remove any remaining HTML tags
  // formattedText = formattedText.replace(/\n{3,}/g, '\n\n')
  formattedText = formattedText.replace(/<br\s*\/?>/gi, '\n')
  formattedText = formattedText.replace(/&nbsp;/gi, '')
  formattedText = formattedText.replace(/<[^>]+>/g, '')

  return formattedText.trim()
}

function splitHtmlIntoGroups (html: string, indent: number) {
  const $ = cheerio.load(html)
  const groups: string[] = []

  // Select all <p>, <ul>, and <ol> tags
  $('p, ul, ol').each((_, element) => {
    $(element).find('strong, em').each((_, elem) => {
      const firstChild = $(elem).contents().first()
      if (firstChild.is('br')) {
        firstChild.remove() // Remove <br> if it's the first child
      }
    })

    const group = $.html(element)
    const content = $(element).text().trim() // Get the text content of the element and trim whitespace


    // Only add non-empty elements to the groups array
    if (content !== '') {
      groups.push(formatText(he.decode(group), indent))
    }
  })

  if (groups.length === 0 && $.text().trim() !== '') {
    const wrappedContent = `<p>${$.text().trim()}</p>`
    groups.push(formatText(wrappedContent, indent))
  }

  return groups
}



export function convertToWhatsAppString (html: string, indent: number = 0): string {
  if (!html) return ''
  const elements = splitHtmlIntoGroups(html, indent)
  let val = elements.join('\n\n')
  return val

}

function splitStringIntoChunks (str: string, chunkSize = 700) {
  const chunks = []
  let start = 0
  while (start < str.length) {
    let end = start + chunkSize
    if (end < str.length) {
      // Ensure we don't split in the middle of a line
      const nextNewline = str.indexOf('\n', end)
      const prevNewline = str.lastIndexOf('\n', end)
      if (nextNewline === -1 && prevNewline === -1) {
        // No newline found, just use the chunk size
        end = str.length
      } else if (nextNewline !== -1 && (prevNewline === -1 || (nextNewline - end) < (end - prevNewline))) {
        // Next newline is closer than the previous one
        end = nextNewline + 1
      } else {
        // Previous newline is closer or there is no next newline
        end = prevNewline + 1
      }
    } else {
      // We're at the end of the string
      end = str.length
    }
    chunks.push(str.slice(start, end))
    start = end
  }
  return chunks
}

export const generateCourseFlow = async function (courseId: string) {
  const flow: CourseFlowItem[] = []
  const courseKey = `${config.redisBaseKey}courses:${courseId}`
  // get the course with all its lessons
  const course = await Courses.findById(courseId)
  if (course && course.status === CourseStatus.PUBLISHED) {
    const courseOwner = await Team.findById(course.owner)
    const settings = await Settings.findById(course.settings)
    // welcome message
    flow.push({
      type: CourseFlowMessageType.WELCOME,
      content: `You have successfully enrolled for the course *${course.title.trim()}* by the organization *${courseOwner?.name}*.\n\nThis is a self paced course, which means you can learn at your own speed.\n\nStart the course anytime at your convenience by tapping 'Start'.`
    })
    const description = convertToWhatsAppString(he.decode(course.description))

    let message = `*Course title*: ${course.title.trim()}\n\n*Course description*: ${description}\n\n*Course Organizer*: ${courseOwner?.name}\n📓 Total lessons in the course: ${course.lessons.length}\n⏰ Avg. time you'd spend on each lesson: ${settings?.metadata.idealLessonTime.value} ${settings?.metadata.idealLessonTime.type}\n🏁 Max lessons per day: ${settings?.metadata.maxLessonsPerDay}\n🗓 Number of days to complete: 2\n\nPlease tap 'Continue' to start your first lesson`
    if (course.contents && course.contents[0] && course.contents[0].assessment) {
      message = `*Course title*: ${course.title.trim()}\n\n*Course description*: ${description}\n\n*Course Organizer*: ${courseOwner?.name}\n📓 Total lessons in the course: ${course.lessons.length}\n⏰ Avg. time you'd spend on each lesson: ${settings?.metadata.idealLessonTime.value} ${settings?.metadata.idealLessonTime.type}\n🏁 Max lessons per day: ${settings?.metadata.maxLessonsPerDay}\n🗓 Number of days to complete: 2\n\nPlease tap 'Continue' to start the initial assessment`
    }
    // course intro
    flow.push({
      type: CourseFlowMessageType.INTRO,
      mediaType: course.headerMedia.mediaType,
      mediaUrl: course.headerMedia.url,
      content: message
    })

    // assesments(if any)

    // blocks
    let lessonIndex = 0
    let lessonCount = 0
    for (let content of course.contents) {
      if (content.lesson) {
        let lessonData = await Lessons.findById(content.lesson)
        if (lessonData) {
          let blockIndex = 0
          for (let blockId of lessonData.blocks) {
            let content = ``
            if (blockIndex === 0) {
              content = `*Lesson ${lessonCount + 1}: ${lessonData.title.trim()}*`
            }

            const blockData = await Blocks.findById(blockId)
            if (blockData) {
              let flo: CourseFlowItem = {
                type: CourseFlowMessageType.BLOCK,
                content,
                block: blockData,
                lesson: lessonData
              }
              content += ` \n\n*Section ${blockIndex + 1}: ${blockData.title.trim()}* \n\n${convertToWhatsAppString(he.decode(blockData.content))}`
              if (blockData.quiz) {
                const quiz = await Quizzes.findById(blockData.quiz)
                if (quiz) {
                  content += `\n\n${convertToWhatsAppString(he.decode(quiz.question))}`
                  flo.quiz = quiz
                  flo.type = CourseFlowMessageType.BLOCKWITHQUIZ
                }
              }
              if (blockData.bodyMedia && blockData.bodyMedia.url) {
                flo.mediaType = blockData.bodyMedia.mediaType
                flo.mediaUrl = blockData.bodyMedia.url
                if (blockData.bodyMedia.mediaType === MediaType.VIDEO) {
                  flo.thumbnailUrl = await generateVideoThumbnail(blockData.bodyMedia.url)
                  flo.mediaUrlEmbed = encodeURI(`${config.clientUrl}/embed/${blockData.bodyMedia.url.replace('https://storage.googleapis.com/kippa-cdn-public/microlearn-images/', '').replace('.mp4', '')}`)
                }
              }

              if (content.length > 1024) {
                let chunks = splitStringIntoChunks(content)
                for (let index = 0; index < chunks.length; index++) {
                  let copy = { ...flo }
                  const element = chunks[index]
                  if (element) {
                    if (index === 0) {
                      copy.type = CourseFlowMessageType.BLOCK
                      copy.content = element
                      delete copy.quiz
                      flow.push(copy)
                    } else {
                      copy = { ...flo }
                      copy.content = element
                      delete copy.mediaType
                      delete copy.mediaUrl
                      delete copy.thumbnailUrl
                      flow.push(copy)
                    }
                  }

                }
              } else {
                flo.content = content
                flow.push(flo)
              }
              blockIndex++
            }
          }
          if (lessonData.quizzes.length > 0) {
            let payload: CourseFlowItem = {
              type: CourseFlowMessageType.STARTQUIZ,
              content: `Congratulations 👏\n\nWe are done with the lesson 🙌. \n\nIt’s time to answer a few questions and test your understanding with a short quiz 🧠
          `
            }
            flow.push(payload)
          }
          let quizIndex = 0
          const quizzes = await Quizzes.find({ _id: { $in: lessonData.quizzes } })
          for (let quizId of lessonData.quizzes) {
            const quizData = await Quizzes.findById(quizId)
            if (quizData) {
              let content = `End of lesson quiz ${quizIndex + 1}/${quizzes.length}\n\nQuestion:\n${convertToWhatsAppString(he.decode(quizData.question))}\n\nChoices: \n\nA: ${quizData.choices[0]} \n\nB: ${quizData.choices[1]} \n\nC: ${quizData.choices[2]}`
              flow.push({
                type: CourseFlowMessageType.QUIZ,
                content,
                lesson: lessonData,
                quiz: quizData
              })
              quizIndex++
            }

          }
          // add score card for the quizes
          if (lessonData.quizzes.length > 0) {
            flow.push({
              type: CourseFlowMessageType.ENDQUIZ,
              content: `Congratulations on finishing the quiz 🥳! Let’s see how well you did 🌚\n\nYou scored: {score}% in this lesson 🏆\nYou are currently ranked #{course_rank} in this course 🏅\nYour course progress: {progress}% ⏱\n\nIn a few seconds, you will see a leaderboard showing the top performers in this course.
          `
            })
          }
          // add intro to the next lesson
          const nextLesson = course.contents[lessonIndex + 1]
          if (nextLesson && nextLesson.lesson) {
            lessonData = await Lessons.findById(nextLesson.lesson)
            if (lessonData) {
              flow.push({
                type: CourseFlowMessageType.ENDLESSON,
                content: `*Next lesson*: ${lessonData.title}\n\n➡️ Tap 'Continue Now' when you're ready to start.\n\nTap 'Continue Tomorrow' to continue tomorrow at 9am tomorrow \n\nTap 'Set Resumption Time' to choose the time to continue tomorrow.\nRemember, If you face any issues while taking the course, respond with a ‘help’ to talk to our support team
            `
              })
            }
          }
          lessonCount++
        }
      }
      if (content.assessment) {
        const assessmentData = await QuestionGroup.findById(content.assessment)
        if (assessmentData) {
          if (assessmentData.questions.length > 0) {
            flow.push({
              type: CourseFlowMessageType.STARTASSESSMENT,
              content: `${assessmentData.message}`,
              assessmentId: assessmentData._id
            })
            let quizIndex = 0
            for (let quizId of assessmentData.questions) {
              const quizData = await Quizzes.findById(quizId)
              if (quizData) {
                let contentString = `${assessmentData.title} ${quizIndex + 1}/${assessmentData.questions.length}\n\nQuestion:\n${convertToWhatsAppString(he.decode(quizData.question))}\n\nChoices: \n\nA: ${quizData.choices[0]} \n\nB: ${quizData.choices[1]} \n\nC: ${quizData.choices[2]}`
                flow.push({
                  type: CourseFlowMessageType.ASSESSMENT,
                  content: contentString,
                  assessment: quizData,
                  questionGroup: assessmentData,
                  assessmentId: assessmentData._id
                })
              }

              quizIndex++
            }
            // add score card for the quizes
            if (assessmentData.questions.length === quizIndex) {
              flow.push({
                type: CourseFlowMessageType.ENDASSESSMENT,
                content: lessonIndex === 0 ? `Great job! Now that you’ve completed this assessment, let’s start the course and learn! 🥳` : `Well done! You've completed this assessment. Let's continue with the course and keep building on what you've learned!`,
                assessmentId: assessmentData._id
              })
            }
          }
          // add intro to the next lesson
          const nextLesson = course.contents[lessonIndex + 1]
          if ((lessonIndex - 1) >= 0 && nextLesson && nextLesson.lesson) {
            let lessonData = await Lessons.findById(nextLesson.lesson)
            if (lessonData) {
              flow.push({
                type: CourseFlowMessageType.ENDLESSON,
                content: `*Next lesson*: ${lessonData.title}\n\n➡️ Tap 'Continue Now' when you're ready to start.\n\nTap 'Continue Tomorrow' to continue tomorrow at 9am tomorrow \n\nTap 'Set Resumption Time' to choose the time to continue tomorrow.
            `
              })
            }
          }
        }
      }
      lessonIndex++
    }
    let load = {
      type: CourseFlowMessageType.ENDCOURSE,
      content: `That was the last lesson 🎊\n\nWell done on finishing the course 🤝\n\nYou’ll be getting your certificate 📄 soon so that you can brag about it😎 `
    }
    if (settings?.disableCertificates) {
      load.content = `That was the last lesson 🎊\n\nWell done on finishing the course 🤝\n\n `
    }
    if (course.survey) {
      if (!settings?.disableCertificates) {
        load.content = `That was the last lesson 🎊\n\nWell done on finishing the course 🤝\n\nYou’ll be getting your certificate 📄 soon so that you can brag about it😎 but first, we want to get your feedback on the course.\n\nWe’ll be sending you a quick survey next 🔎`
      } else {
        load.content = load.content + `but first, we want to get your feedback on the course.\n\nWe’ll be sending you a quick survey next 🔎`
      }
    }
    flow.push(load)

    if (course.survey) {
      const survey = await Survey.findById(course.survey)
      if (survey) {
        for (let question of survey.questions) {
          if (question.responseType === ResponseType.MULTI_CHOICE) {
            flow.push({
              type: CourseFlowMessageType.SURVEY_MULTI_CHOICE,
              content: `${question.question}\n\nChoices: \nA: ${question.choices[0]} \nB: ${question.choices[1]} \nC: ${question.choices[2]}`,
              surveyQuestion: question,
              surveyId: course.survey
            })
          } else {
            flow.push({
              type: CourseFlowMessageType.SURVEY_FREE_FORM,
              content: `${question.question} \n\nType your response and send it.`,
              surveyQuestion: question,
              surveyId: course.survey
            })
          }
        }

        let load = {
          type: CourseFlowMessageType.END_SURVEY,
          content: `That was the last survey question 🎊\n\nThank you for your feedback about this course 🤝.`
        }
        flow.push(load)
      }
    }
    if (redisClient.isReady) {
      await redisClient.del(courseKey)
      await redisClient.set(courseKey, JSON.stringify(flow))
    }
  }

}

export const sendMessage = async function (message: Message, team?: TeamsInterface) {
  const subscription = await Subscriptions.findOne({ owner: team?.id }).populate("plan")
  let token = config.whatsapp.token
  let phoneId = config.whatsapp.phoneNumberId
  if (subscription && typeof subscription.plan !== "string") {
    const value = subscription.plan.price

    if (value > 0 && team?.facebookData && team?.facebookData.status === "CONFIRMED") {
      token = team.facebookData.token || config.whatsapp.token
      phoneId = team?.facebookData.phoneNumberId || config.whatsapp.phoneNumberId
    }
  }


  try {
    console.log("starting to send a message")
    const result = await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, message, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    })
    console.info("done sending whatsapp message", (result as AxiosResponse).data)
  } catch (error) {
    console.error((error as AxiosError).response?.data)
  }
}

export const sendInactivityMessage = async (payload: { studentId: string, courseId: string, slackToken: string, team: string, slackChannel?: string, phoneNumber?: string }) => {
  const jobs = await agenda.jobs({
    name: RESUME_TOMORROW,
    'data.enrollment.student': payload.studentId,
    nextRunAt: { $ne: null }
  })
  if (jobs.length > 0) {
    return
  }
  const course = await Courses.findById(payload.courseId)
  const student = await Students.findById(payload.studentId)
  if (course && student) {
    // const msgId = v4()
    if (payload.phoneNumber && !payload.slackChannel) {
      const key = `${config.redisBaseKey}enrollments:${payload.phoneNumber}:${payload.courseId}`
      const dtf = await redisClient.get(key)
      if (dtf) {
        let redisData: CourseEnrollment = JSON.parse(dtf)
        if (redisData.active) {
          if (redisData.totalBlocks <= redisData.nextBlock) {
            return
          }
          agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
            to: payload.phoneNumber,
            type: "interactive",
            team: payload.team,
            messaging_product: "whatsapp",
            recipient_type: "individual",
            interactive: {
              body: {
                text: `Hey ${student.firstName}! It looks like you have been idle for quite some time 🤔.\n\nOther learners are getting ahead.\n Click 'Continue' to move forward in the course.`
              },
              type: "button",
              action: {
                buttons: [
                  {
                    type: "reply",
                    reply: {
                      id: `continue_${payload.courseId}`,
                      title: "Continue"
                    }
                  }
                ]
              }
            }
          })
          // await redisClient.set(key, JSON.stringify({ ...redisData, lastMessageId: msgId }))
        }
      }
    } else if (payload.slackChannel && payload.slackToken && !payload.phoneNumber) {
      const key = `${config.redisBaseKey}enrollments:slack:${payload.slackChannel}:${payload.courseId}`
      const dtf = await redisClient.get(key)
      if (dtf) {
        let redisData: CourseEnrollment = JSON.parse(dtf)
        if (redisData.active) {
          if (redisData.totalBlocks <= redisData.nextBlock) {
            return
          }
          agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
            channel: payload.slackChannel,
            accessToken: payload.slackToken || "",
            message: {
              blocks: [
                {
                  type: MessageBlockType.SECTION,
                  text: {
                    type: SlackTextMessageTypes.MARKDOWN,
                    text: `Hey ${student.firstName}! It looks like you have been idle for quite some time 🤔.\n\nOther learners are getting ahead.\n Click 'Continue' to move forward in the course.`
                  },
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
                      "value": `continue_${payload.courseId}`,
                      style: MessageActionButtonStyle.PRIMARY
                    }
                  ]
                }
              ]
            }
          })
          // await redisClient.set(key, JSON.stringify({ ...redisData, lastMessageId: msgId }))
        }
      }
    }
  }

}

export const sendShortInactivityMessage = async (payload: { studentId: string, courseId: string, slackToken: string, slackChannel?: string, phoneNumber?: string, team: string }) => {
  const jobs = await agenda.jobs({
    name: RESUME_TOMORROW,
    'data.enrollment.student': payload.studentId,
    nextRunAt: { $ne: null }
  })
  if (jobs.length > 0) {
    return
  }
  const course = await Courses.findById(payload.courseId)
  const student = await Students.findById(payload.studentId)
  if (course && student) {
    const msgId = v4()
    if (payload.phoneNumber && !payload.slackChannel) {
      const key = `${config.redisBaseKey}enrollments:${payload.phoneNumber}:${payload.courseId}`
      const dtf = await redisClient.get(key)
      if (dtf) {
        let redisData: CourseEnrollment = JSON.parse(dtf)
        if (redisData.active) {
          if (redisData.totalBlocks <= redisData.nextBlock) {
            return
          }
          console.log("sending a message")
          agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
            to: payload.phoneNumber,
            team: payload.team,
            type: "interactive",
            messaging_product: "whatsapp",
            recipient_type: "individual",
            interactive: {
              body: {
                text: `Hey ${student.firstName}! It looks like you have been inactive in the course *${course.title.trim()}* 🤔.\n\nIn case you are stuck due to technical reasons, please click 'Continue' to resume the course, or click help to speak with a support person`
              },
              type: "button",
              action: {
                buttons: [
                  {
                    type: "reply",
                    reply: {
                      id: `continue_${payload.courseId}`,
                      title: "Continue"
                    }
                  },
                  {
                    type: "reply",
                    reply: {
                      id: `HELP`,
                      title: "Help"
                    }
                  }
                ]
              }
            }
          })
          // await redisClient.set(key, JSON.stringify({ ...redisData, lastMessageId: msgId }))
        }
      }
    } else if (payload.slackChannel && payload.slackToken && !payload.phoneNumber) {
      const key = `${config.redisBaseKey}enrollments:slack:${payload.slackChannel}:${payload.courseId}`
      const dtf = await redisClient.get(key)
      if (dtf) {
        let redisData: CourseEnrollment = JSON.parse(dtf)
        if (redisData.active) {
          if (redisData.totalBlocks <= redisData.nextBlock) {
            return
          }
          agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
            channel: payload.slackChannel,
            accessToken: payload.slackToken || "",
            message: {
              blocks: [
                {
                  type: MessageBlockType.SECTION,
                  text: {
                    type: SlackTextMessageTypes.MARKDOWN,
                    text: `Hey ${student.firstName}! It looks like you have been inactive in the course 🤔.\n\nIn case you are stuck due to technical reasons, please click 'Continue' to resume the course, or click help to speak with a support person`
                  },
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
                      "value": `continue_${payload.courseId}|${msgId}`,
                      style: MessageActionButtonStyle.PRIMARY
                    },
                    {
                      "type": SlackActionType.BUTTON,
                      "url": "https://wa.link/cd7fgk",
                      "text": {
                        "type": SlackTextMessageTypes.PLAINTEXT,
                        "text": "Help",
                        "emoji": true
                      },
                      "value": `help`,
                      style: MessageActionButtonStyle.PRIMARY
                    }
                  ]
                }
              ]
            }
          })
          await redisClient.set(key, JSON.stringify({ ...redisData, lastMessageId: msgId }))
        }
      }
    }
  }

}

export const scheduleInactivityMessage = async (enrollment: CourseEnrollment, phoneNumber?: string, slackChannel?: string) => {
  if (enrollment.inactivityPeriod) {
    const jobs = await agenda.jobs({ name: INACTIVITY_REMINDER, 'data.courseId': enrollment.id, 'data.studentId': enrollment.student })
    // Check if the job exists
    for (let job of jobs) {
      await job.remove()
    }
    agenda.schedule(`in ${enrollment.inactivityPeriod.value} ${enrollment.inactivityPeriod.type}`, INACTIVITY_REMINDER, { studentId: enrollment.student, courseId: enrollment.id, slackToken: enrollment.slackToken, slackChannel, phoneNumber, team: enrollment.team, })
  }
  const jobs = await agenda.jobs({ name: INACTIVITY_REMINDER_SHORT, 'data.courseId': enrollment.id, 'data.studentId': enrollment.student })
  // Check if the job exists
  for (let job of jobs) {
    await job.remove()
  }
  agenda.schedule(`in 3 minutes`, INACTIVITY_REMINDER_SHORT, { studentId: enrollment.student, courseId: enrollment.id, team: enrollment.team, slackToken: enrollment.slackToken, slackChannel, phoneNumber })
}

export const scheduleDailyRoutine = async () => {
  const jobs = await agenda.jobs({ name: DAILY_ROUTINE, nextRunAt: { $ne: null } })
  // const teams = await Teams.find()
  // for (let team of teams) {
  //   const courses = await Courses.find({ status: CourseStatus.PUBLISHED, owner: team.id })
  //   for (let course of courses) {
  //     agenda.now<{ courseId: string, teamId: string }>(SYNC_STUDENT_ENROLLMENTS, { courseId: course.id, teamId: team.id })
  //   }
  // }

  if (jobs.length === 0) {
    agenda.every('0 1 * * *', DAILY_ROUTINE)
  }
}



export const handleRemindMeTrigger = async function () {
  let phone = "2348138641965"
  console.log("got here.")
  let student = await Students.findOne({ phoneNumber: phone })
  if (student) {
    let enrollments = await fetchEnrollments(phone)
    let active = enrollments.find(e => e.active)
    if (active) {
      let course = await Courses.findById(active.id)
      if (course) {
        agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
          to: student.phoneNumber,
          type: "interactive",
          messaging_product: "whatsapp",
          recipient_type: "individual",
          interactive: {
            body: {
              text: `Hey ${student.firstName.charAt(0).toUpperCase() + student.firstName.slice(1)}! You have made ${((active.nextBlock / active.totalBlocks) * 100).toFixed(0)}% progress in the course ${active.title}.🎉\n\nContinue now to learn more from the course 🎯.`
            },
            type: "button",
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: `continue_${active.id}`,
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

export const sendBlockContent = async (data: CourseFlowItem, phoneNumber: string, messageId: string, team: string): Promise<void> => {
  try {
    let buttons: ReplyButton[] = []
    if (data.type === CourseFlowMessageType.BLOCK) {
      buttons.push({
        type: "reply",
        reply: {
          id: CONTINUE,
          title: "Continue"
        }
      })
    } else {
      buttons = [
        {
          type: "reply",
          reply: {
            id: QUIZ_YES + `|${messageId}`,
            title: "Yes"
          }
        },
        {
          type: "reply",
          reply: {
            id: QUIZ_NO + `|${messageId}`,
            title: "No"
          }
        },
      ]
    }
    let payload: Message = {
      to: phoneNumber,
      team,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        body: {
          text: data.content
        },
        type: "button",
        action: {
          buttons
        }
      }
    }

    if (payload.interactive && data.mediaType && data.mediaUrl && data.mediaUrl.length > 10) {
      payload.interactive['header'] = {
        type: data.mediaType
      }
      if (data.mediaType === MediaType.IMAGE && payload.interactive.header) {
        payload.interactive.header.image = {
          link: data.mediaUrl
        }
      }
      if ((data.mediaType === MediaType.VIDEO || data.mediaType === MediaType.AUDIO) && payload.interactive.header) {
        payload.interactive.header.video = {
          link: data.mediaUrl
        }
      }
    }

    // update the blockStartTime

    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, payload)
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

export const startCourse = async (phoneNumber: string, courseId: string, studentId: string): Promise<string> => {
  const course: CourseInterface | null = await Courses.findById(courseId)
  const student: StudentInterface | null = await Students.findById(studentId)
  const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${courseId}`
  const initialMessageId = v4()
  if (course && student) {
    const settings = await Settings.findById(course.settings)
    if (redisClient.isReady) {
      const courseKey = `${config.redisBaseKey}courses:${courseId}`
      const courseFlow = await redisClient.get(courseKey)
      if (courseFlow) {
        const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
        const redisData: CourseEnrollment = {
          team: course.owner,
          tz: student.tz,
          student: studentId,
          id: courseId,
          inactivityPeriod: settings?.inactivityPeriod,
          lastActivity: new Date().toISOString(),
          lastLessonCompleted: new Date().toISOString(),
          lastMessageId: initialMessageId,
          title: course.title,
          description: convertToWhatsAppString(he.decode(course.description)),
          active: true,
          quizAttempts: 0,
          progress: 0,
          currentBlock: 0,
          nextBlock: 1,
          totalBlocks: courseFlowData.length,
          maxLessonsPerDay: settings?.metadata?.maxLessonsPerDay || 2,
          minLessonsPerDay: settings?.metadata?.minLessonsPerDay || 1,
          dailyLessonsCount: 0,
          owedLessonsCount: 0
        }
        let enrollments: CourseEnrollment[] = await fetchEnrollments(phoneNumber)
        let active: CourseEnrollment[] = enrollments.filter(e => e.active)
        if (active.length > 0) {
          // mark it as not active
          for (let act of active) {
            let copy = { ...act }
            copy.active = false
            const keyOld = `${config.redisBaseKey}enrollments:${phoneNumber}:${act.id}`
            await redisClient.set(keyOld, JSON.stringify(copy))
          }
        }
        await redisClient.set(key, JSON.stringify(redisData))
      }
    }
  }
  return initialMessageId
}

export const startBundle = async (phoneNumber: string, courseId: string, studentId: string): Promise<string> => {
  const course: CourseInterface | null = await Courses.findById(courseId)
  const student: StudentInterface | null = await Students.findById(studentId)
  const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${courseId}`
  const initialMessageId = v4()
  if (course && student) {
    let titles: string[] = []
    for (let id of course.courses) {
      let course = await Courses.findById(id).select("title")
      if (course) {
        titles.push(course.title)
      }
    }
    const settings = await Settings.findById(course.settings)
    if (redisClient.isReady) {
      let totalBlocks = 0
      const description = convertToWhatsAppString(he.decode(course.description))
      const courseOwner = await Team.findById(course.owner)
      let payload: CourseFlowItem = {
        type: CourseFlowMessageType.INTRO,
        content: `This is a bundle of courses. \n*Bundle title*: ${course.title.trim()}\n\n*Bundle description*: ${description}\n\n*Course Organizer*: ${courseOwner?.name}\n📓 Total courses in the bundle: ${course.courses.length}. \n\nYou will receive the following courses in this order;\n${titles.map((title, index) => `${index + 1}. *${title}*`).join('\n')}. \nHappy learning.`
      }
      if (course.headerMedia && course.headerMedia.url && course.headerMedia.url.startsWith('https://')) {
        payload.mediaType = course.headerMedia.mediaType
        payload.mediaUrl = course.headerMedia.url
      }
      let flows: CourseFlowItem[] = [
        payload
      ]

      for (let id of course.courses) {
        let flow = await redisClient.get(`${config.redisBaseKey}courses:${id}`)
        if (flow) {
          const courseFlowData: CourseFlowItem[] = JSON.parse(flow)
          flows.push(...courseFlowData)
        }
      }
      // const endOfBundleMessage = {
      //   type: CourseFlowMessageType.END_OF_BUNDLE,
      //   mediaType: course.headerMedia?.mediaType || "",
      //   mediaUrl: course.headerMedia?.url || "",
      //   content: `Congratulations on completing.\n *Bundle title*: ${course.title.trim()}\n\n*Bundle description*: ${description}\n\n*Course Organizer*: ${courseOwner?.name}\n📓 Total courses in the bundle: ${course.courses.length}. \n\nCourses completed are\n${courses.map((r, index) => `${index + 1}. *${r.title}*`).join('\n')}.`
      // }


      // flows.push(endOfBundleMessage)

      flows = flows.filter(e => !e.surveyId)
      flows = flows.filter(e => e.type !== CourseFlowMessageType.END_SURVEY)
      flows = flows.filter(e => e.type !== CourseFlowMessageType.WELCOME)

      // Find the index of the last 'end-of-course' item
      const lastEndOfCourseIndex = flows.map(item => item.type).lastIndexOf(CourseFlowMessageType.ENDCOURSE)

      const updatedFlows = flows.map((item, index) => {
        if (item.type === CourseFlowMessageType.ENDCOURSE) {
          if (index === lastEndOfCourseIndex) {
            // Return a different message for the last 'end-of-course' item
            return {
              type: CourseFlowMessageType.ENDCOURSE,
              mediaType: course?.headerMedia?.mediaType || "",
              mediaUrl: course?.headerMedia?.url || "",
              content: 'Congratulations on completing this course,\nThis is the last course in the Bundle\nYou will receive your certificate shortly.'
            }
          } else {
            // Return the regular message for all other 'end-of-course' items
            return {
              type: CourseFlowMessageType.ENDCOURSE,
              mediaType: course?.headerMedia?.mediaType || "",
              mediaUrl: course?.headerMedia?.url || "",
              content: 'Congratulations on completing this course,\nYou will receive the next course in the bundle shortly.\n'
            }
          }
        }
        return item
      })

      totalBlocks = updatedFlows.length
      redisClient.set(`${config.redisBaseKey}courses:${courseId}`, JSON.stringify(updatedFlows))

      if (totalBlocks > 0) {
        const redisData: CourseEnrollment = {
          team: course.owner,
          tz: student.tz,
          student: studentId,
          id: courseId,
          inactivityPeriod: settings?.inactivityPeriod,
          lastActivity: new Date().toISOString(),
          lastLessonCompleted: new Date().toISOString(),
          lastMessageId: initialMessageId,
          title: course.title,
          description: convertToWhatsAppString(he.decode(course.description)),
          active: true,
          quizAttempts: 0,
          progress: 0,
          currentBlock: -1,
          nextBlock: 0,
          totalBlocks,
          bundle: true,
          maxLessonsPerDay: settings?.metadata?.maxLessonsPerDay || 2,
          minLessonsPerDay: settings?.metadata?.minLessonsPerDay || 1,
          dailyLessonsCount: 0,
          owedLessonsCount: 0
        }
        let enrollments: CourseEnrollment[] = await fetchEnrollments(phoneNumber)
        let active: CourseEnrollment[] = enrollments.filter(e => e.active)
        if (active.length > 0) {
          // mark it as not active
          for (let act of active) {
            let copy = { ...act }
            copy.active = false
            const keyOld = `${config.redisBaseKey}enrollments:${phoneNumber}:${act.id}`
            await redisClient.set(keyOld, JSON.stringify(copy))
          }
        }
        await redisClient.set(key, JSON.stringify(redisData))
      }
    }
  }
  return initialMessageId
}

export async function fetchEnrollments (phoneNumber: string): Promise<CourseEnrollment[]> {
  const enrollments: CourseEnrollment[] = []
  if (redisClient.isReady) {
    const pattern = `${config.redisBaseKey}enrollments:${phoneNumber}:*`
    let cursor = 0
    const allKeys = []

    do {
      const result = await redisClient.scan(cursor, {
        COUNT: 100,
        MATCH: pattern
      })

      cursor = result.cursor
      const keys = result.keys

      allKeys.push(...keys)
    } while (cursor !== 0)

    for (let key of allKeys) {
      const dt = await redisClient.get(key)
      if (dt) {
        enrollments.push(JSON.parse(dt))
      }
    }
  }
  return enrollments
}


export const sendQuiz = async (item: CourseFlowItem, phoneNumber: string, messageId: string, team: string): Promise<void> => {
  try {
    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
      to: phoneNumber,
      team,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        body: {
          text: item.content
        },
        type: "button",
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: QUIZ_A + `|${messageId}`,
                title: "A"
              }
            },
            {
              type: "reply",
              reply: {
                id: QUIZ_B + `|${messageId}`,
                title: "B"
              }
            },
            {
              type: "reply",
              reply: {
                id: QUIZ_C + `|${messageId}`,
                title: "C"
              }
            }
          ]
        }
      }
    })
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

export const sendAssessment = async (item: CourseFlowItem, phoneNumber: string, messageId: string, team: string): Promise<void> => {
  try {
    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
      to: phoneNumber,
      team,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        body: {
          text: item.content
        },
        type: "button",
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: QUIZA_A + `|${messageId}`,
                title: "A"
              }
            },
            {
              type: "reply",
              reply: {
                id: QUIZA_B + `|${messageId}`,
                title: "B"
              }
            },
            {
              type: "reply",
              reply: {
                id: QUIZA_C + `|${messageId}`,
                title: "C"
              }
            }
          ]
        }
      }
    })
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

export const sendMultiSurvey = async (item: CourseFlowItem, phoneNumber: string, messageId: string, team: string): Promise<void> => {
  try {
    if (item.surveyQuestion) {
      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
        to: phoneNumber,
        team,
        type: "interactive",
        messaging_product: "whatsapp",
        recipient_type: "individual",
        interactive: {
          body: {
            text: item.content
          },
          type: "button",
          action: {
            buttons: [
              ...item.surveyQuestion.choices.map((_, index) => ({
                type: "reply",
                reply: {
                  id: index === 0 ? SURVEY_A : index === 1 ? SURVEY_B : SURVEY_C + `|${messageId}|${item.surveyQuestion?.id}`,
                  title: index === 0 ? "A" : index === 1 ? "B" : "C"
                }
              } as ReplyButton))
            ]
          }
        }
      })
    }
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

export const sendFreeformSurvey = async (item: CourseFlowItem, phoneNumber: string, team: string): Promise<void> => {
  try {
    console.log(team, "send free form survey")
    if (item.surveyQuestion) {
      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
        to: phoneNumber,
        team,
        type: "text",
        messaging_product: "whatsapp",
        recipient_type: "individual",
        text: {
          body: item.content
        }
      })
    }
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

export const sendWelcome = async (phoneNumber: string, team: string): Promise<void> => {
  try {
    let payload: Message = {
      team,
      "messaging_product": "whatsapp",
      "recipient_type": "individual",
      "to": phoneNumber,
      "type": "template",
      "template": {
        "language": { "code": "en_US" },
        "name": "successful_optin_no_variable"
      },
    }
    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, payload)
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}


export const sendIntro = async (currentIndex: string, phoneNumber: string): Promise<void> => {
  try {
    if (redisClient.isReady) {
      const courseKey = `${config.redisBaseKey}courses:${currentIndex}`
      const courseFlow = await redisClient.get(courseKey)
      if (courseFlow) {
        const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
        const item = courseFlowData[0]
        if (item) {
          agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
            to: phoneNumber,
            type: "interactive",
            messaging_product: "whatsapp",
            recipient_type: "individual",
            interactive: {
              body: {
                text: item.content
              },
              type: "button",
              action: {
                buttons: [
                  {
                    type: "reply",
                    reply: {
                      id: START,
                      title: "Start now"
                    }
                  }
                ]
              }
            }
          })
        }
      }
    }
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}


export const handleContinue = async (nextIndex: number, courseKey: string, phoneNumber: string, messageId: string, data: CourseEnrollment): Promise<void> => {
  const flow = await redisClient.get(courseKey)
  if (flow) {
    const flowData: CourseFlowItem[] = JSON.parse(flow)
    let item = flowData[nextIndex]
    const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${data?.id}`
    if (item) {
      if (item.type === CourseFlowMessageType.WELCOME) {
        nextIndex += 1
        item = flowData[nextIndex]
        if (!item) return
      }
      if (data) {
        let updatedData: CourseEnrollment = { ...data, lastMessageId: messageId, currentBlock: nextIndex, nextBlock: nextIndex + 1 }
        let currentItem = flowData[data.currentBlock]
        if (currentItem && (currentItem.type === CourseFlowMessageType.BLOCK || currentItem.type === CourseFlowMessageType.BLOCKWITHQUIZ)) {
          console.log("CHECKING FOR BLOCK DURATION")
          // calculate the elapsed time and update stats service
          if (data.blockStartTime) {
            let diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
            if (diffInSeconds > 250) {
              diffInSeconds = 200
            }
            console.log("BLOCK DURATION =>", diffInSeconds)

            try {
              await saveBlockDuration(data.team, data.student, diffInSeconds, currentItem.lesson, currentItem.block)
            } catch (error) {
              console.log("FAILED TO SAVE BLOCK DURATION =>", error)
            }
            updatedData = { ...updatedData, blockStartTime: null, lastActivity: new Date().toISOString() }
          }
        }




        switch (item.type) {
          case CourseFlowMessageType.STARTASSESSMENT:
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
              team: data.team,
              type: "interactive",
              messaging_product: "whatsapp",
              recipient_type: "individual",
              interactive: {
                body: {
                  text: item.content
                },
                type: "button",
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: CONTINUE,
                        title: "Continue"
                      }
                    }
                  ]
                }
              }
            })
            updatedData = { ...updatedData, assessmentId: item.assessmentId || '' }
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.ENDASSESSMENT:
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
              team: data.team,
              type: "interactive",
              messaging_product: "whatsapp",
              recipient_type: "individual",
              interactive: {
                body: {
                  text: item.content
                },
                type: "button",
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: CONTINUE,
                        title: "Continue"
                      }
                    }
                  ]
                }
              }
            })
            studentService.saveAssessmentScore(data.team, data.id, data.student, updatedData.assessmentId || '', updatedData.assessmentScore || 0)
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            updatedData = { ...updatedData, assessmentScore: 0 }
            // handleContinue(nextIndex + 1, courseKey, phoneNumber, v4(), updatedData)
            break
          case CourseFlowMessageType.STARTQUIZ:
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
              team: data.team,
              type: "interactive",
              messaging_product: "whatsapp",
              recipient_type: "individual",
              interactive: {
                body: {
                  text: item.content
                },
                type: "button",
                action: {
                  buttons: [
                    {
                      type: "reply",
                      reply: {
                        id: CONTINUE,
                        title: "Continue"
                      }
                    }
                  ]
                }
              }
            })
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.ENDQUIZ:
            const progress = (data.currentBlock / data.totalBlocks) * 100
            let score = '0'
            let currentItem = flowData[data.currentBlock]
            if (currentItem && currentItem.quiz && currentItem.quiz.lesson && data.lessons) {
              let scores = data.lessons[currentItem.quiz.lesson]?.scores
              if (scores) {
                score = ((scores.reduce((a, b) => a + b, 0) / scores.length) * 100).toFixed(0)
              }
            }
            try {
              const dbRef = db.ref(COURSE_STATS).child(data.team).child(data.id).child("students")
              // get existing data
              const snapshot = await dbRef.once('value')
              let rtdb: { [id: string]: StudentCourseStats } | null = snapshot.val()
              let rankings: StudentCourseStats[] = []
              if (rtdb) {
                let stds: StudentCourseStats[] = Object.values(rtdb)
                if (stds.length > 1) {
                  rankings = stds.map(student => {
                    // Calculate the total score across all lessons and quizzes
                    let totalScore = 0
                    if (student.lessons) {
                      totalScore = Object.values(student.lessons).reduce((lessonAcc, lesson) => {
                        let quizScoreSum = 0
                        if (lesson.quizzes) {
                          quizScoreSum = Object.values(lesson.quizzes).reduce((quizAcc, quiz) => quizAcc + quiz.score, 0)
                        }
                        return lessonAcc + quizScoreSum
                      }, 0)
                    }

                    // Attach the total score to the student object
                    return { ...student, totalScore }
                  }).sort((a: StudentCourseStats, b: StudentCourseStats) => {
                    return (b.totalScore || 0) - (a.totalScore || 0)
                  })
                } else {
                  rankings = stds
                }
              }
              const rank = rankings.findIndex(e => e.phoneNumber === phoneNumber)
              agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                to: phoneNumber,
                team: data.team,
                type: "text",
                messaging_product: "whatsapp",
                recipient_type: "individual",
                text: {
                  body: item.content.replace('{progress}', Math.ceil(progress).toString()).replace('{score}', score).replace('{course_rank}', (rank >= 0 ? rank + 1 : 1).toString())
                }
              })
              await delay(10000)
              agenda.now<CourseEnrollment>(SEND_LEADERBOARD, {
                ...updatedData
              })
              updatedData.lastLessonCompleted = new Date().toISOString()
              saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
              break
            } catch (error) {
              console.log(error)
            }

            break
          case CourseFlowMessageType.ENDCOURSE:
            if (data.bundle) {
              if (updatedData.totalBlocks - updatedData.nextBlock < 4) {
                agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                  to: phoneNumber,
                  team: data.team,
                  type: 'text',
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  text: {
                    body: item.content.replace('{survey}', ''),
                  },
                })
                await delay(5000)
                let next = flowData[nextIndex + 1]
                if ((next?.surveyId && next.surveyQuestion) || data.bundle) {
                  updatedData = { ...updatedData, nextBlock: updatedData.nextBlock + 1, currentBlock: nextIndex + 1 }
                  handleContinue(nextIndex + 1, courseKey, phoneNumber, v4(), updatedData)
                } else {
                  // if no survey for this course, then send the certificate
                  agenda.now<CourseEnrollment>(SEND_CERTIFICATE, {
                    ...updatedData,
                  })
                }
              } else {
                if (!moment(updatedData.finishedLastLessonAt).isSame(moment(), 'day')) {
                  updatedData = { ...updatedData, dailyLessonsCount: 1 }
                } else {
                  updatedData = { ...updatedData, dailyLessonsCount: updatedData.dailyLessonsCount + 1 }
                }

                let message = `Congratulations! 🎉 on completing the last lesson in this course! 🙌🏽 \nYou have completed ${updatedData.dailyLessonsCount} today but you're required to complete ${updatedData.minLessonsPerDay} daily.\nTo reach the daily minimum lesson target, you have to complete ${updatedData.minLessonsPerDay - updatedData.dailyLessonsCount} lessons.\nTap continue now to get the next course in the Bundle.\nWe're rooting for you!`.toString()

                if (updatedData.maxLessonsPerDay - updatedData.dailyLessonsCount > 0) {
                  if (updatedData.minLessonsPerDay - updatedData.dailyLessonsCount > 0) {
                    const stringToRemove = [
                      "\n\nTap 'Continue Tomorrow' to continue tomorrow at 9am tomorrow \n\nTap 'Set Resumption Time' to choose the time to continue tomorrow.",
                      "\n\nTap 'Continue Tomorrow' to continue tomorrow at 9am tomorrow \n\nTap",
                      "'Set Resumption Time' to choose the time to continue tomorrow",
                    ]
                    stringToRemove.forEach((substring) => {
                      message = message.replace(new RegExp(substring, 'g'), '')
                    })

                    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                      to: phoneNumber,
                      team: data.team,
                      type: 'interactive',
                      messaging_product: 'whatsapp',
                      recipient_type: 'individual',
                      interactive: {
                        body: {
                          text: message,
                        },
                        type: 'button',
                        action: {
                          buttons: [
                            {
                              type: 'reply',
                              reply: {
                                id: CONTINUE + `|${messageId}`,
                                title: 'Continue Now',
                              },
                            },
                          ],
                        },
                      },
                    })
                  } else {
                    message = `Congratulations! 🎉 on completing this course.\nYou've reached today's learning target!\nLessons completed today:  ${updatedData.dailyLessonsCount} \nMaximum daily lessons ${updatedData.maxLessonsPerDay}\nYou can still complete ${updatedData.maxLessonsPerDay - updatedData.dailyLessonsCount} lessons today.`.toString()

                    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                      to: phoneNumber,
                      type: 'interactive',
                      team: data.team,
                      messaging_product: 'whatsapp',
                      recipient_type: 'individual',
                      interactive: {
                        body: {
                          text: message,
                        },
                        type: 'button',
                        action: {
                          buttons: [
                            {
                              type: 'reply',
                              reply: {
                                id: CONTINUE + `|${messageId}`,
                                title: 'Continue Now',
                              },
                            },
                            {
                              type: 'reply',
                              reply: {
                                id: TOMORROW + `|${messageId}`,
                                title: 'Continue Tomorrow',
                              },
                            },
                            {
                              type: 'reply',
                              reply: {
                                id: SCHEDULE_RESUMPTION + `|${messageId}`,
                                title: 'Set Resumption Time',
                              },
                            },
                          ],
                        },
                      },
                    })
                  }
                } else {
                  message = `\nGreat job! 🥳 on completing this course.\nYou've reached the maximum lesson target for today.\nGo over what you've learnt today and come back tomorrow to continue with the next course in the bundle 😉`.toString()
                  agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                    to: phoneNumber,
                    type: 'interactive',
                    team: data.team,
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    interactive: {
                      body: {
                        text: message,
                      },
                      type: 'button',
                      action: {
                        buttons: [
                          {
                            type: 'reply',
                            reply: {
                              id: TOMORROW + `|${messageId}`,
                              title: 'Continue Tomorrow',
                            },
                          },
                          {
                            type: 'reply',
                            reply: {
                              id: SCHEDULE_RESUMPTION + `|${messageId}`,
                              title: 'Set Resumption Time',
                            },
                          },
                        ],
                      },
                    },
                  })
                }
                await redisClient.set(key, JSON.stringify({ ...updatedData }))
              }
            } else {
              agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                to: phoneNumber,
                type: 'text',
                team: data.team,
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                text: {
                  body: item.content.replace('{survey}', ''),
                },
              })
              await delay(5000)
              let next = flowData[nextIndex + 1]
              if ((next?.surveyId && next.surveyQuestion) || data.bundle) {
                updatedData = { ...updatedData, nextBlock: updatedData.nextBlock + 1, currentBlock: nextIndex + 1 }
                handleContinue(nextIndex + 1, courseKey, phoneNumber, v4(), updatedData)
              } else {
                // if no survey for this course, then send the certificate
                agenda.now<CourseEnrollment>(SEND_CERTIFICATE, {
                  ...updatedData,
                })
              }
            }
            break
          case CourseFlowMessageType.END_OF_BUNDLE:
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
              type: "text",
              team: data.team,
              messaging_product: "whatsapp",
              recipient_type: "individual",
              text: {
                body: item.content.replace('{survey}', '')
              }
            })

            await delay(5000)
            let nextFlow = flowData[nextIndex + 1]
            if (nextFlow?.surveyId && nextFlow.surveyQuestion) {
              updatedData = { ...updatedData, nextBlock: updatedData.nextBlock + 1, currentBlock: nextIndex + 1 }
              handleContinue(nextIndex + 1, courseKey, phoneNumber, v4(), updatedData)
            } else {
              // if no survey for this course, then send the certificate
              agenda.now<CourseEnrollment>(SEND_CERTIFICATE, {
                ...updatedData
              })
            }

            break
          case CourseFlowMessageType.ENDLESSON:
            if (!moment(updatedData.finishedLastLessonAt).isSame(moment(), 'day')) {
              updatedData = { ...updatedData, dailyLessonsCount: 1 }
            } else {
              updatedData = { ...updatedData, dailyLessonsCount: updatedData.dailyLessonsCount + 1 }
            }

            if (flowData[nextIndex + 1]?.type == CourseFlowMessageType.STARTASSESSMENT) {
              agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                to: phoneNumber,
                team: data.team,
                type: "interactive",
                messaging_product: "whatsapp",
                recipient_type: "individual",
                interactive: {
                  body: {
                    text: 'Well done on completing the last lesson! 🙌🏽 \n Please click continue to proceed with the rest of the course'
                  },
                  type: "button",
                  action: {
                    buttons: [
                      {
                        type: "reply",
                        reply: {
                          id: CONTINUE + `|${messageId}`,
                          title: "Continue"
                        }
                      },

                    ]
                  }
                }
              })
            } else {
              let message = item.content + `\nWell done on completing the last lesson! 🙌🏽 \nYou have completed ${updatedData.dailyLessonsCount} today but you're required to complete ${updatedData.minLessonsPerDay} daily.\nTo reach the daily minimum lesson target, you have to complete ${updatedData.minLessonsPerDay - updatedData.dailyLessonsCount} lessons.\nWe're rooting for you!`.toString()

              if (updatedData.maxLessonsPerDay - updatedData.dailyLessonsCount > 0) {
                if (updatedData.minLessonsPerDay - updatedData.dailyLessonsCount > 0) {
                  const stringToRemove = ["\n\nTap 'Continue Tomorrow' to continue tomorrow at 9am tomorrow \n\nTap 'Set Resumption Time' to choose the time to continue tomorrow.", "\n\nTap 'Continue Tomorrow' to continue tomorrow at 9am tomorrow \n\nTap", "'Set Resumption Time' to choose the time to continue tomorrow"]
                  stringToRemove.forEach(substring => {
                    message = message.replace(new RegExp(substring, 'g'), '')
                  })

                  agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                    to: phoneNumber,
                    team: data.team,
                    type: "interactive",
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    interactive: {
                      body: {
                        text: message
                      },
                      type: "button",
                      action: {
                        buttons: [
                          {
                            type: "reply",
                            reply: {
                              id: CONTINUE + `|${messageId}`,
                              title: "Continue Now"
                            }
                          },

                        ]
                      }
                    }
                  })

                } else {
                  message = item.content + `\nCongratulations! 🎉 You've reached today's learning target!\nLessons completed today:  ${updatedData.dailyLessonsCount} \nMaximum daily lessons ${updatedData.maxLessonsPerDay}\nYou can still complete ${updatedData.maxLessonsPerDay - updatedData.dailyLessonsCount} lessons today`.toString()

                  agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                    to: phoneNumber,
                    team: data.team,
                    type: "interactive",
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    interactive: {
                      body: {
                        text: message
                      },
                      type: "button",
                      action: {
                        buttons: [
                          {
                            type: "reply",
                            reply: {
                              id: CONTINUE + `|${messageId}`,
                              title: "Continue Now"
                            }
                          },
                          {
                            type: "reply",
                            reply: {
                              id: TOMORROW + `|${messageId}`,
                              title: "Continue Tomorrow"
                            }
                          },
                          {
                            type: "reply",
                            reply: {
                              id: SCHEDULE_RESUMPTION + `|${messageId}`,
                              title: "Set Resumption Time"
                            }
                          }
                        ]
                      }
                    }
                  })
                }
              } else {
                message = item.content + `\nGreat job! 🥳 You've reached the maximum lesson target for today.\nGo over what you've learnt today and come back tomorrow for more 😉`.toString()
                const stringToRemove = ["\n\n➡️ Tap 'Continue Now' when you're ready to start.\n"]
                stringToRemove.forEach(substring => {
                  message = message.replace(new RegExp(substring, 'g'), '')
                })
                agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
                  to: phoneNumber,
                  team: data.team,
                  type: "interactive",
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  interactive: {
                    body: {
                      text: message
                    },
                    type: "button",
                    action: {
                      buttons: [
                        {
                          type: "reply",
                          reply: {
                            id: TOMORROW + `|${messageId}`,
                            title: "Continue Tomorrow"
                          }
                        },
                        {
                          type: "reply",
                          reply: {
                            id: SCHEDULE_RESUMPTION + `|${messageId}`,
                            title: "Set Resumption Time"
                          }
                        }
                      ]
                    }
                  }
                })
              }
              updatedData.finishedLastLessonAt = new Date().getTime()
            }

            await redisClient.set(key, JSON.stringify({ ...updatedData }))
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.QUIZ:
            await sendQuiz(item, phoneNumber, messageId, data.team)
            updatedData = { ...updatedData, quizAttempts: 0, blockStartTime: new Date().toISOString() }
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.ASSESSMENT:
            await sendAssessment(item, phoneNumber, messageId, data.team)
            updatedData = { ...updatedData, blockStartTime: new Date().toISOString() }
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.INTRO:
            let interactive: InteractiveMessage["interactive"] = {
              header: {
                type: item.mediaType || MediaType.IMAGE,
                image: {
                  link: item.mediaUrl || ""
                }
              },
              body: {
                text: item.content
              },
              type: "button",
              action: {
                buttons: [
                  {
                    type: "reply",
                    reply: {
                      id: CONTINUE,
                      title: "Continue"
                    }
                  }
                ]
              }
            }
            if (!item.mediaUrl || !item.mediaUrl.startsWith("https://")) {
              delete interactive.header
            }
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
              team: data.team,
              type: "interactive",
              messaging_product: "whatsapp",
              recipient_type: "individual",
              interactive
            })
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.BLOCK:
          case CourseFlowMessageType.BLOCKWITHQUIZ:
            await sendBlockContent(item, phoneNumber, messageId, data.team)
            updatedData = { ...updatedData, blockStartTime: new Date().toISOString() }
            console.log(updatedData)
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.SURVEY_MULTI_CHOICE:
            await sendMultiSurvey(item, phoneNumber, messageId, data.team)
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.SURVEY_FREE_FORM:
            await sendFreeformSurvey(item, phoneNumber, data.team)
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break

          case CourseFlowMessageType.END_SURVEY:
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
              type: "text",
              team: data.team,
              messaging_product: "whatsapp",
              recipient_type: "individual",
              text: {
                body: item.content
              }
            })
            await delay(5000)
            agenda.now<CourseEnrollment>(SEND_CERTIFICATE, {
              ...updatedData
            })
            break
          default:
            break
        }

        await redisClient.set(key, JSON.stringify({ ...updatedData }))
      }
    } else {
      agenda.now<CourseEnrollment>(SEND_CERTIFICATE, {
        ...data
      })
      await redisClient.set(key, JSON.stringify({ ...data, currentBlock: data.totalBlocks, nextBlock: data.totalBlocks }))
    }
  }
}

export const handleBlockQuiz = async (answer: string, data: CourseEnrollment, phoneNumber: string, messageId: string): Promise<void> => {
  const courseKey = `${config.redisBaseKey}courses:${data.id}`
  const courseFlow = await redisClient.get(courseKey)
  let updatedData = { ...data, lastMessageId: messageId }
  if (courseFlow) {
    const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
    const item = courseFlowData[data.currentBlock]
    let payload: Message = {
      to: phoneNumber,
      team: data.team,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        body: {
          text: ``
        },
        type: "button",
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: CONTINUE,
                title: "Continue"
              }
            }
          ]
        }
      }
    }
    if (item && item.quiz) {
      let correctAnswer = item.quiz.choices[item.quiz.correctAnswerIndex]
      if (payload.interactive) {
        if (correctAnswer === answer) {
          // send correct answer context
          payload.interactive['body'].text = `That is correct!. ${convertToWhatsAppString(he.decode(item.quiz.correctAnswerContext))}`
        } else {
          // send wrong answer context
          payload.interactive['body'].text = `That is incorrect!. ${convertToWhatsAppString(he.decode(item.quiz.wrongAnswerContext))}`
        }
      }
      // calculate the elapsed time and update stats service
      console.log("CHECKING FOR BLOCK DURATION")
      // calculate the elapsed time and update stats service
      if (data.blockStartTime) {
        let diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
        if (diffInSeconds > 250) {
          diffInSeconds = 200
        }
        console.log("BLOCK DURATION =>", diffInSeconds)

        try {
          await saveBlockDuration(data.team, data.student, diffInSeconds, item.lesson, item.block)
        } catch (error) {
          console.log("FAILED TO SAVE BLOCK DURATION =>", error)
        }
        updatedData = { ...updatedData, blockStartTime: null, lastActivity: new Date().toISOString() }
      }
      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, payload)
    }

  }
  const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${data?.id}`
  redisClient.set(key, JSON.stringify({ ...updatedData }))
}

export const handleLessonQuiz = async (answer: number, data: CourseEnrollment, phoneNumber: string, messageId: string): Promise<void> => {
  const courseKey = `${config.redisBaseKey}courses:${data.id}`
  const courseFlow = await redisClient.get(courseKey)
  if (courseFlow) {
    const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
    const item = courseFlowData[data.currentBlock]
    let payload: Message = {
      to: phoneNumber,
      team: data.team,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        body: {
          text: ``
        },
        type: "button",
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: CONTINUE,
                title: "Continue"
              }
            }
          ]
        }
      }
    }
    if (item && item.quiz) {
      const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${data.id}`
      let updatedData: CourseEnrollment = { ...data, lastMessageId: messageId }
      let duration = 0, retakes = 0, saveStats = false, score = 0
      if (payload.interactive) {
        if (item.quiz.correctAnswerIndex === answer) {
          // send correct answer context
          payload.interactive['body'].text = `That is correct!. ${convertToWhatsAppString(he.decode(item.quiz.correctAnswerContext))}`
          // update stats(retakes and duration)
          retakes = data.quizAttempts
          saveStats = true
          if (data.blockStartTime) {
            let diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
            if (diffInSeconds > 250) {
              diffInSeconds = 250
            }
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
            if (!item.quiz.hint || item.quiz.hint.length < 2) {
              textBody = `Not quite right!.\n\nPlease try again: \n\n${item.content}`
            }
            payload.interactive.action.buttons = [
              {
                type: "reply",
                reply: {
                  id: QUIZ_A + `|${messageId}`,
                  title: "A"
                }
              },
              {
                type: "reply",
                reply: {
                  id: QUIZ_B + `|${messageId}`,
                  title: "B"
                }
              },
              {
                type: "reply",
                reply: {
                  id: QUIZ_C + `|${messageId}`,
                  title: "C"
                }
              }
            ]
          } else {
            retakes = updatedData.quizAttempts
            saveStats = true
            if (data.blockStartTime) {
              let diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
              if (diffInSeconds > 250) {
                diffInSeconds = 200
              }
              duration = diffInSeconds
              updatedData = { ...updatedData, blockStartTime: null }
            }
            score = 0
            // compute the score
          }
          // send wrong answer context
          payload.interactive['body'].text = textBody
        }
      }
      if (item.quiz.lesson) {
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
      }
      await redisClient.set(key, JSON.stringify(updatedData))
      if (saveStats) {
        saveQuizDuration(data.team, data.student, updatedData.id, duration, score, retakes, item.lesson, item.quiz)
      }
      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, payload)
    }
  }
}

export const handleAssessment = async (answer: number, data: CourseEnrollment, phoneNumber: string, messageId: string): Promise<void> => {
  const courseKey = `${config.redisBaseKey}courses:${data.id}`
  const courseFlow = await redisClient.get(courseKey)
  let updatedData: CourseEnrollment = { ...data, lastMessageId: messageId }

  if (courseFlow) {
    const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
    const item = courseFlowData[data.currentBlock]
    let message: string = "Answer received, continue to the next question"
    let payload: Message = {
      to: phoneNumber,
      team: data.team,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        body: {
          text: message
        },
        type: "button",
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: CONTINUE,
                title: "Continue"
              }
            }
          ]
        }
      }
    }
    if (item && item.assessment) {
      const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${data.id}`
      updatedData = { ...updatedData, lastMessageId: messageId }
      // let duration = 0, retakes = 0, saveStats = false, score = 0
      if (payload.interactive) {
        if (item.assessment.correctAnswerIndex === answer) {
          // send correct answer context
          // payload.interactive['body'].text = `That is correct!. ${convertToWhatsAppString(he.decode(item.assessment.correctAnswerContext))}`
          // update stats(retakes and duration)
          // retakes = data.quizAttempts
          // saveStats = true
          if (data.blockStartTime) {
            let diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
            if (diffInSeconds > 250) {
              diffInSeconds = 250
            }
            // duration = diffInSeconds
            updatedData = { ...updatedData, blockStartTime: null, assessmentScore: (updatedData.assessmentScore || 0) + 1 }
          }
          // score = 1
          // compute the score
        }

      }

      await redisClient.set(key, JSON.stringify(updatedData))
      // if (saveStats) {
      //   saveQuizDuration(data.team, data.student, updatedData.id, duration, score, retakes, item.lesson, item.quiz)
      // }
      if (courseFlowData[data.currentBlock + 1]?.content && courseFlowData[data.currentBlock + 1]?.type == "end-of-assessment") {
        message = courseFlowData[data.currentBlock + 1]?.content || ""
        // updatedData = { ...updatedData, currentBlock: data.currentBlock + 1 }
        handleContinue(data.currentBlock + 1, courseKey, phoneNumber, v4(), updatedData)
      } else {
        agenda.now<Message>(SEND_WHATSAPP_MESSAGE, payload)
      }
    }
  }
}

export const handleSurveyMulti = async (answer: number, data: CourseEnrollment, phoneNumber: string, messageId: string): Promise<void> => {
  try {
    const courseKey = `${config.redisBaseKey}courses:${data.id}`
    const courseFlow = await redisClient.get(courseKey)
    const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${data?.id}`
    if (courseFlow) {
      const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
      const item = courseFlowData[data.currentBlock]
      if (item && item.surveyId) {
        // save the survey response
        if (item.surveyQuestion && item.surveyQuestion?.choices[answer]) {
          await SurveyResponse.updateOne({
            course: data.id,
            student: data.student,
            survey: item.surveyId,
            surveyQuestion: item.surveyQuestion.id,
          }, {
            survey: item.surveyId,
            team: data.team,
            surveyQuestion: item.surveyQuestion.id,
            course: data.id,
            student: data.student,
            response: item.surveyQuestion.choices[answer],
            responseType: ResponseType.MULTI_CHOICE
          }, { upsert: true })
        }
        // check if the next block is a survey
        let nextBlock = courseFlowData[data.nextBlock]
        if (nextBlock) {
          if (nextBlock.surveyId) {
            // if next block is survey, check if it is multi-choice survey or freeform
            if (nextBlock.type === CourseFlowMessageType.SURVEY_MULTI_CHOICE) {
              // if it is multi, send multi survey
              console.log("sending multi choice")
              sendMultiSurvey(nextBlock, phoneNumber, messageId, data.team)
            } else {
              console.log("sending freeform")
              // else send freeform
              sendFreeformSurvey(nextBlock, phoneNumber, data.team)
            }
            // update redis and rtdb
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            let updatedData: CourseEnrollment = { ...data, lastMessageId: messageId, currentBlock: data.nextBlock, nextBlock: data.nextBlock + 1 }
            await redisClient.set(key, JSON.stringify({ ...updatedData }))
          } else if (nextBlock.type === CourseFlowMessageType.END_SURVEY) {
            handleContinue(data.currentBlock + 1, courseKey, phoneNumber, v4(), data)
          }
        } else {
          handleContinue(data.currentBlock + 1, courseKey, phoneNumber, v4(), data)
        }
      }
    }
  } catch (error) {
    console.log(error)
  }
}



export const handleSurveyFreeform = async (answer: string, data: CourseEnrollment, phoneNumber: string, messageId: string): Promise<void> => {
  const courseKey = `${config.redisBaseKey}courses:${data.id}`
  const courseFlow = await redisClient.get(courseKey)
  const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${data?.id}`
  if (courseFlow) {
    const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
    const item = courseFlowData[data.currentBlock]
    if (item && item.surveyId) {
      // save the survey response
      if (item.surveyQuestion) {
        await SurveyResponse.updateOne({
          course: data.id,
          survey: item.surveyId,
          student: data.student,
          surveyQuestion: item.surveyQuestion.id,
        }, {
          survey: item.surveyId,
          team: data.team,
          surveyQuestion: item.surveyQuestion.id,
          course: data.id,
          student: data.student,
          response: answer,
          responseType: ResponseType.FREE_FORM
        }, { upsert: true })
      }
      // check if the next block is a survey
      let nextBlock = courseFlowData[data.nextBlock]
      if (nextBlock) {
        if (nextBlock.surveyId) {
          // if next block is survey, check if it is multi-choice survey or freeform
          if (nextBlock.type === CourseFlowMessageType.SURVEY_MULTI_CHOICE) {
            // if it is multi, send multi survey
            sendMultiSurvey(nextBlock, phoneNumber, messageId, data.team)
          } else {
            // else send freeform
            sendFreeformSurvey(nextBlock, phoneNumber, data.team)
          }
          // update redis and rtdb
          saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
          let updatedData: CourseEnrollment = { ...data, lastMessageId: messageId, currentBlock: data.nextBlock, nextBlock: data.nextBlock + 1 }
          await redisClient.set(key, JSON.stringify({ ...updatedData }))
        } else if (nextBlock.type === CourseFlowMessageType.END_SURVEY) {
          handleContinue(data.currentBlock + 1, courseKey, phoneNumber, v4(), data)
        }
      } else {
        handleContinue(data.currentBlock + 1, courseKey, phoneNumber, v4(), data)
      }
    }
  }
}

export const sendAuthMessage = async () => {

  let request_body = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "",
    "type": "template",
    "template": {
      "language": { "code": "en_US" },
      "name": "TEMPLATE_NAME",
      "components": [
        {
          "type": "BODY",
          "parameters": [
            { "type": "text", "text": "" },
          ],
        },
        {
          "type": "BUTTON",
          "sub_type": "url",
          "index": 0,
          "parameters": [
            { "type": "text", "text": "otp" },
          ],
        },
      ],
    },
  }
  logger.info(request_body)
}

export const sendResumptionOptions = async (phoneNumber: string, key: string, data: CourseEnrollment): Promise<void> => {
  try {
    let msgId = v4()
    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
      to: phoneNumber,
      team: data.team,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        body: {
          text: `You have chosen to resume this course tomorrow. \n\nSelect a time tomorrow to resume this course.\n\n\n*Morning*: Resume at 9am tomorrown\n*Afternoon*: Resume at 3pm tomorrown\n*Evening*: Resume at 8pm tomorrow`
        },
        type: "button",
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: MORNING + `|${msgId}`,
                title: "Morning"
              }
            },
            {
              type: "reply",
              reply: {
                id: AFTERNOON + `|${msgId}`,
                title: "Afternoon"
              }
            },
            {
              type: "reply",
              reply: {
                id: EVENING + `|${msgId}`,
                title: "Evening"
              }
            }
          ]
        }
      }
    })
    redisClient.set(key, JSON.stringify({ ...data, lastMessageId: msgId }))
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}


export const sendResumptionMessage = async (phoneNumber: string, _: string, data: CourseEnrollment): Promise<void> => {
  try {
    // let msgId = v4()
    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
      to: phoneNumber,
      team: data.team,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        header: {
          type: MediaType.TEXT,
          text: "Welcome back"
        },
        body: {
          text: `You scheduled to resume the course *${data.title.trim()} today at this time.*\n\nYou can resume your scheduled course by clicking the "Resume Now" button below`
        },
        type: "button",
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: RESUME_COURSE_TOMORROW,
                title: "Resume Now"
              }
            }
          ]
        }
      }
    })
    // redisClient.set(key, JSON.stringify({ ...data, lastMessageId: msgId }))
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

export const sendScheduleAcknowledgement = async (phoneNumber: string, time: string, team: string): Promise<void> => {
  try {
    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
      to: phoneNumber,
      type: "text",
      team,
      messaging_product: "whatsapp",
      recipient_type: "individual",
      text: {
        body: `You have chosen to resume this course at ${time} tomorrow. \n\nWe will continue this course for you at this time.`
      }
    })
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}

export const exchangeFacebookToken = async function (code: string, team: string) {
  try {
    const result: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
      params: {
        'client_id': config.facebook.id,
        'client_secret': config.facebook.secret,
        'code': code,
        'grant_type': 'authorization_code'
      }
    })
    const token = result.data.access_token
    let teamData = await teamService.fetchTeamById(team)
    if (teamData && teamData.facebookBusinessId && teamData.facebookPhoneNumberId) {
      const updatePayload: FacebookIntegrationData = { phoneNumberId: teamData.facebookPhoneNumberId, businessId: teamData.facebookBusinessId, status: "PENDING", token, phoneNumber: "" }
      await teamService.updateTeamInfo(team, {
        facebookData: updatePayload
      })
      // register the phone number
      await axios.post(`https://graph.facebook.com/v19.0/${updatePayload.phoneNumberId}/register`, {
        messaging_product: "whatsapp",
        pin: "112233"
      }, {
        headers: {
          "Authorization": `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      // subscribe to webhooks
      await axios.post(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/subscribed_apps`, {

      }, {
        headers: {
          "Authorization": `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      // copy the auth template to the new waba from main account
      // get the auth template

      const parentTemplatesResults: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${config.whatsapp.waba}/message_templates?fields=name,status,category,components,language`, {
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`
        }
      })
      const childTemplatesResults: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates?fields=name,status,category,components`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const parent_optin_template = parentTemplatesResults.data.data.filter((e: any) => e.name === "successful_optin_no_variable")
      const child_optin_template = childTemplatesResults.data.data.filter((e: any) => e.name === "successful_optin_no_variable")
      if (child_optin_template.length === 0) {
        if (parent_optin_template.length === 1) {
          let original: any = parent_optin_template[0]
          await axios.post(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates`, {
            name: original.name,
            category: original.category,
            language: original.language,
            components: original.components
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })

          await delay(3000)
          const templates: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates?fields=name,status,category,components`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
          let optin_template = templates.data.data.find((e: any) => e.name === "successful_optin_no_variable")
          if (!optin_template || optin_template.status !== "APPROVED") {
            updatePayload.status = "PENDING"
            // schedule an event in 24 hours to check again
            agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
          } else {
            updatePayload.status = "CONFIRMED"
          }
        }
      } else {
        let optin_template = child_optin_template[0]
        if (!optin_template || optin_template.status !== "APPROVED") {
          updatePayload.status = "PENDING"
          // schedule an event in 24 hours to check again
          agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
        } else {
          updatePayload.status = "CONFIRMED"
        }
      }

      const parent_auth_template = parentTemplatesResults.data.data.filter((e: any) => e.name === config.whatsapp.authTemplateName)
      const child_auth_template = childTemplatesResults.data.data.filter((e: any) => e.name === config.whatsapp.authTemplateName)
      if (child_auth_template.length === 0) {
        if (parent_auth_template.length === 1) {
          let original: any = parent_auth_template[0]
          await axios.post(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates`, {
            name: original.name,
            category: original.category,
            language: original.language,
            components: [{
              "type": "BODY",
              "add_security_recommendation": true
            }, original.components[1]]
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })

          await delay(3000)
          const templates: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates?fields=name,status,category,components`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
          let optin_template = templates.data.data.find((e: any) => e.name === config.whatsapp.authTemplateName)
          if (!optin_template || optin_template.status !== "APPROVED") {
            updatePayload.status = "PENDING"
            // schedule an event in 24 hours to check again
            agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
          } else {
            updatePayload.status = "CONFIRMED"
          }
        }
      } else {
        let optin_template = child_auth_template[0]
        if (!optin_template || optin_template.status !== "APPROVED") {
          updatePayload.status = "PENDING"
          // schedule an event in 24 hours to check again
          agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
        } else {
          updatePayload.status = "CONFIRMED"
        }
      }

      const parent_reg_success_template = parentTemplatesResults.data.data.filter((e: any) => e.name === "registration_successful")
      const child_reg_success_template = childTemplatesResults.data.data.filter((e: any) => e.name === "registration_successful")
      if (child_reg_success_template.length === 0) {
        if (parent_reg_success_template.length === 1) {
          let original: any = parent_reg_success_template[0]
          await axios.post(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates`, {
            name: original.name,
            category: original.category,
            language: original.language,
            components: original.components
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })

          await delay(3000)
          const templates: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates?fields=name,status,category,components`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          })
          let optin_template = templates.data.data.find((e: any) => e.name === "registration_successful")
          if (!optin_template || optin_template.status !== "APPROVED") {
            updatePayload.status = "PENDING"
            // schedule an event in 24 hours to check again
            agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
          } else {
            updatePayload.status = "CONFIRMED"
          }
        }
      } else {
        let optin_template = child_auth_template[0]
        if (!optin_template || optin_template.status !== "APPROVED") {
          updatePayload.status = "PENDING"
          // schedule an event in 24 hours to check again
          // agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
        } else {
          updatePayload.status = "CONFIRMED"
        }
      }
      await teamService.updateTeamInfo(team, {
        facebookData: updatePayload
      })
    }
  } catch (error) {
    console.log("Something Failed in this flow =>", (error as AxiosError))
    console.log("Something Failed in this flow =>", (error as AxiosError)?.response?.data)
  }
}


export const reloadTemplates = async function (team: string) {
  try {

    let teamData = await teamService.fetchTeamById(team)
    if (teamData && teamData.facebookData && teamData.facebookData.token) {
      const updatePayload: FacebookIntegrationData = { ...JSON.parse(JSON.stringify(teamData.facebookData)) }
      const parentTemplatesResults: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${config.whatsapp.waba}/message_templates?fields=name,status,category,components,language`, {
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`
        }
      })
      const childTemplatesResults: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates?fields=name,status,category,components`, {
        headers: {
          Authorization: `Bearer ${teamData.facebookData.token}`
        }
      })

      const parent_optin_template = parentTemplatesResults.data.data.filter((e: any) => e.name === "successful_optin_no_variable")
      const child_optin_template = childTemplatesResults.data.data.filter((e: any) => e.name === "successful_optin_no_variable")
      if (child_optin_template.length === 0) {
        if (parent_optin_template.length === 1) {
          let original: any = parent_optin_template[0]
          await axios.post(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates`, {
            name: original.name,
            category: original.category,
            language: original.language,
            components: original.components
          }, {
            headers: {
              Authorization: `Bearer ${teamData.facebookData.token}`
            }
          })

          await delay(3000)
          const templates: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates?fields=name,status,category,components`, {
            headers: {
              Authorization: `Bearer ${teamData.facebookData.token}`
            }
          })
          let optin_template = templates.data.data.find((e: any) => e.name === "successful_optin_no_variable")
          if (!optin_template || optin_template.status !== "APPROVED") {
            updatePayload.status = "PENDING"
            // schedule an event in 24 hours to check again
            agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
          } else {
            updatePayload.status = "CONFIRMED"
          }
        }
      } else {
        let optin_template = child_optin_template[0]
        if (!optin_template || optin_template.status !== "APPROVED") {
          updatePayload.status = "PENDING"
          // schedule an event in 24 hours to check again
          agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
        } else {
          updatePayload.status = "CONFIRMED"
        }
      }

      const parent_auth_template = parentTemplatesResults.data.data.filter((e: any) => e.name === config.whatsapp.authTemplateName)
      const child_auth_template = childTemplatesResults.data.data.filter((e: any) => e.name === config.whatsapp.authTemplateName)
      if (child_auth_template.length === 0) {
        if (parent_auth_template.length === 1) {
          let original: any = parent_auth_template[0]
          await axios.post(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates`, {
            name: original.name,
            category: original.category,
            language: original.language,
            components: [{
              "type": "BODY",
              "add_security_recommendation": true
            }, original.components[1]]
          }, {
            headers: {
              Authorization: `Bearer ${teamData.facebookData.token}`
            }
          })

          await delay(3000)
          const templates: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates?fields=name,status,category,components`, {
            headers: {
              Authorization: `Bearer ${teamData.facebookData.token}`
            }
          })
          let optin_template = templates.data.data.find((e: any) => e.name === config.whatsapp.authTemplateName)
          console.log("returned payload", templates.data.data, optin_template)
          if (!optin_template || optin_template.status !== "APPROVED") {
            updatePayload.status = "PENDING"
            // schedule an event in 24 hours to check again
            agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
          } else {
            updatePayload.status = "CONFIRMED"
          }
        }
      } else {
        let optin_template = child_auth_template[0]
        if (!optin_template || optin_template.status !== "APPROVED") {
          updatePayload.status = "PENDING"
          // schedule an event in 24 hours to check again
          // agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
        } else {
          updatePayload.status = "CONFIRMED"
        }
      }


      const parent_reg_success_template = parentTemplatesResults.data.data.filter((e: any) => e.name === "registration_successful")
      const child_reg_success_template = childTemplatesResults.data.data.filter((e: any) => e.name === "registration_successful")
      if (child_reg_success_template.length === 0) {
        if (parent_reg_success_template.length === 1) {
          let original: any = parent_reg_success_template[0]
          await axios.post(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates`, {
            name: original.name,
            category: original.category,
            language: original.language,
            components: original.components
          }, {
            headers: {
              Authorization: `Bearer ${teamData.facebookData.token}`
            }
          })

          await delay(3000)
          const templates: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates?fields=name,status,category,components`, {
            headers: {
              Authorization: `Bearer ${teamData.facebookData.token}`
            }
          })
          let optin_template = templates.data.data.find((e: any) => e.name === "registration_successful")
          if (!optin_template || optin_template.status !== "APPROVED") {
            updatePayload.status = "PENDING"
            // schedule an event in 24 hours to check again
            agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
          } else {
            updatePayload.status = "CONFIRMED"
          }
        }
      } else {
        let optin_template = child_auth_template[0]
        if (!optin_template || optin_template.status !== "APPROVED") {
          updatePayload.status = "PENDING"
          // schedule an event in 24 hours to check again
          // agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
        } else {
          updatePayload.status = "CONFIRMED"
        }
      }
      await teamService.updateTeamInfo(team, {
        facebookData: updatePayload
      })
    }
  } catch (error) {
    console.log("Something Failed in this flow =>", (error as AxiosError))
    console.log("Something Failed in this flow =>", (error as AxiosError)?.response?.data)
  }
}



export const handleDelayedFacebookStatus = async function (team: string) {
  try {
    let teamData = await teamService.fetchTeamById(team)
    if (teamData && teamData.facebookData) {
      const updatePayload: FacebookIntegrationData = { phoneNumberId: teamData.facebookData.phoneNumberId, businessId: teamData.facebookData.businessId, token: teamData.facebookData.token, status: teamData.facebookData.status, phoneNumber: teamData.facebookData.phoneNumber || "" }

      const childTemplatesResults: AxiosResponse = await axios.get(`https://graph.facebook.com/v19.0/${updatePayload.businessId}/message_templates?fields=name,status,category,components`, {
        headers: {
          Authorization: `Bearer ${updatePayload.token}`
        }
      })

      const child_optin_template = childTemplatesResults.data.data.filter((e: any) => e.name === "successful_optin_no_variable")
      const child_auth_template = childTemplatesResults.data.data.filter((e: any) => e.name === config.whatsapp.authTemplateName)
      const child_reg_success_template = childTemplatesResults.data.data.filter((e: any) => e.name === "registration_successful")
      if (child_optin_template.length > 0) {
        let optin_template = child_optin_template[0]
        if (!optin_template || optin_template.status !== "APPROVED") {
          updatePayload.status = "PENDING"
          agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
        } else {
          updatePayload.status = "CONFIRMED"
        }
      }

      if (child_auth_template.length > 0) {
        let optin_template = child_auth_template[0]
        if (!optin_template || optin_template.status !== "APPROVED") {
          updatePayload.status = "PENDING"
          agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
        } else {
          updatePayload.status = "CONFIRMED"
        }
      }

      if (child_reg_success_template.length > 0) {
        let optin_template = child_reg_success_template[0]
        if (!optin_template || optin_template.status !== "APPROVED") {
          // updatePayload.status = "PENDING"
          agenda.schedule("in 5 hours", DELAYED_FACEBOOK_INTEGRATION, { teamId: team })
        } else {
          updatePayload.status = "CONFIRMED"
        }
      }
      await teamService.updateTeamInfo(team, {
        facebookData: updatePayload
      })
    }
  } catch (error) {
    // @ts-ignore
    console.log((error as AxiosError).response.data)
  }
}

export const handleHelp = async (phoneNumber: string, courseId: string): Promise<void> => {
  try {
    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
      to: phoneNumber,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        type: "cta_url",
        body: {
          text: `Click on help to talk to our support`
        },
        action: {
          name: "cta_url",
          parameters: {
            display_text: "Talk to support",
            url: "https://wa.link/cd7fgk"
          }
        }
      }
    })

    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
      to: phoneNumber,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        body: { text: "Click continue to continue with the rest of the course" },
        type: "button",
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: `continue_${courseId}`,
                title: "Continue"
              }
            }
          ]
        }
      }
    })
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, (error as any).message)
  }
}


import httpStatus from 'http-status'
import ApiError from '../errors/ApiError'
import { BlockInterface } from '../courses/interfaces.blocks'
import { QuizInterface } from '../courses/interfaces.quizzes'
import { CONTINUE, CourseEnrollment, Message, QUIZ_A, QUIZ_B, QUIZ_C, QUIZ_NO, QUIZ_YES, ReplyButton, SCHEDULE_RESUMPTION, START, SURVEY_A, SURVEY_B, SURVEY_C, TOMORROW } from './interfaces.webhooks'
import axios, { AxiosResponse } from 'axios'
import config from '../../config/config'
import { redisClient } from '../redis'
import Courses from '../courses/model.courses'
import { Team } from '../teams'
import { CourseInterface, MediaType } from '../courses/interfaces.courses'
import he from "he"
import db from "../rtdb"
import Settings from '../courses/model.settings'
import Lessons from '../courses/model.lessons'
import Blocks from '../courses/model.blocks'
import Quizzes from '../courses/model.quizzes'
import { agenda } from '../scheduler'
import { SEND_CERTIFICATE, SEND_LEADERBOARD, SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { v4 } from 'uuid'
import { logger } from '../logger'
import moment from 'moment'
import { LessonInterface } from '../courses/interfaces.lessons'
import { saveBlockDuration, saveCourseProgress, saveQuizDuration } from '../students/students.service'
import { delay } from '../generators/generator.service'
import { Survey, SurveyResponse } from '../surveys'
import { Question, ResponseType } from '../surveys/survey.interfaces'
import { COURSE_STATS } from '../rtdb/nodes'
import { StudentCourseStats } from '../students/interface.students'

enum CourseFlowMessageType {
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
  END_SURVEY = 'end-survey'

}

interface CourseFlowItem {
  type: CourseFlowMessageType
  content: string
  mediaType?: MediaType
  mediaUrl?: string
  block?: BlockInterface
  lesson?: LessonInterface
  quiz?: QuizInterface
  surveyQuestion?: Question
  surveyId?: string
}

// interface UserTracker {
//   courseId: string
//   currentIndex: number
//   currentType: CourseFlowMessageType
// }

export function convertToWhatsAppString (html: string, indent: number = 0): string {
  if (!html) return ''
  let formattedText = html
  formattedText = formattedText.replace(/\n/g, '')
  // Replace <br /> tags with new lines
  formattedText = formattedText.replace(/<br\s*\/?>/gi, '\n')

  // Replace <b> tags with *
  formattedText = formattedText.replace(/<b>(.*?)<\/b>/gi, '*$1*')

  // Replace <i> tags with _
  formattedText = formattedText.replace(/<i>(.*?)<\/i>/gi, '_$1_')

  // Handle lists
  // Replace <ul> and <ol> tags with new lines
  formattedText = formattedText.replace(/<\/?ul.*?>/gi, '\n')
  formattedText = formattedText.replace(/<\/?ol.*?>/gi, '\n')

  // Replace <li> tags with "-" for unordered lists and numbers for ordered lists
  formattedText = formattedText.replace(/<li>(.*?)<\/li>/gi, (_, content) => {
    const indentation = ' '.repeat(indent * 2)
    return `\n${indentation}- ${convertToWhatsAppString(content, indent + 1)}`
  })

  // Remove any remaining HTML tags
  formattedText = formattedText.replace(/<[^>]+>/g, '')

  return formattedText.trim()
}

export const generateCourseFlow = async function (courseId: string) {
  const flow: CourseFlowItem[] = []
  const courseKey = `${config.redisBaseKey}courses:${courseId}`
  // get the course with all its lessons
  const course = await Courses.findById(courseId)
  if (course) {
    const courseOwner = await Team.findById(course.owner)
    const settings = await Settings.findById(course.settings)
    // welcome message
    flow.push({
      type: CourseFlowMessageType.WELCOME,
      content: `You have successfully enrolled for the course *${course.title}* by the organization *${courseOwner?.name}*.\n\nThis is a self paced course, which means you can learn at your own speed.\n\nStart the course anytime at your convenience by tapping 'Start'.`
    })
    const description = convertToWhatsAppString(he.decode(course.description))
    // course intro
    flow.push({
      type: CourseFlowMessageType.INTRO,
      mediaType: course.headerMedia.mediaType,
      mediaUrl: course.headerMedia.url,
      content: `*Course title*: ${course.title}\n\n*Course description*: ${description}\n\n*Course Organizer*: ${courseOwner?.name}\n📓 Total lessons in the course: ${course.lessons.length}\n⏰ Avg. time you'd spend on each lesson: ${settings?.metadata.idealLessonTime.value} ${settings?.metadata.idealLessonTime.type}\n🏁 Max lessons per day: ${settings?.metadata.maxLessonsPerDay}\n🗓 Number of days to complete: 2\n\nPlease tap 'Continue' to start your first lesson
      `
    })

    // assesments(if any)

    // blocks
    let lessonIndex = 0
    // const nextLesson = course.lessons[lessonIndex]
    // if (nextLesson) {
    //   let lessonData = await Lessons.findById(nextLesson)
    //   if (lessonData) {
    //     flow.push({
    //       type: CourseFlowMessageType.ENDLESSON,
    //       content: `*First lesson*: ${lessonData.title}\n\n➡️ Tap 'Continue Now' when you're ready to start.\n\nTap 'Continue Tomorrow' to continue tomorrow at \n\nTap 'Set Resumption Time' to choose the time to continue tomorrow.`
    //     })
    //   }
    // }
    for (let lesson of course.lessons) {
      let lessonData = await Lessons.findById(lesson)
      if (lessonData) {
        let blockIndex = 0
        for (let blockId of lessonData.blocks) {
          let content = ``
          if (blockIndex === 0) {
            content = `*Lesson ${lessonIndex + 1}: ${lessonData.title.trim()}*`
          }
          const blockData = await Blocks.findById(blockId)
          if (blockData) {
            content += ` \n\n*Section ${blockIndex + 1}: ${blockData.title.trim()}* \n\n${convertToWhatsAppString(he.decode(blockData.content))}`
            if (blockData.quiz) {
              const quiz = await Quizzes.findById(blockData.quiz)
              if (quiz) {
                content += `\n${convertToWhatsAppString(he.decode(quiz.question))}`
                let flo: CourseFlowItem = {
                  type: CourseFlowMessageType.BLOCKWITHQUIZ,
                  content,
                  block: blockData,
                  lesson: lessonData,
                  quiz,
                }
                if (blockData.bodyMedia && blockData.bodyMedia.url && blockData.bodyMedia.url.length > 10) {
                  flo.mediaType = blockData.bodyMedia.mediaType
                  flo.mediaUrl = blockData.bodyMedia.url
                }
                flow.push(flo)
              }
            } else {
              let flo: CourseFlowItem = {
                type: CourseFlowMessageType.BLOCK,
                content,
                block: blockData,
                lesson: lessonData
              }
              if (blockData.bodyMedia && blockData.bodyMedia.url && blockData.bodyMedia.url.length > 10) {
                flo.mediaType = blockData.bodyMedia.mediaType
                flo.mediaUrl = blockData.bodyMedia.url
              }
              flow.push(flo)
            }
          }
          blockIndex++
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
        for (let quizId of lessonData.quizzes) {
          const quizData = await Quizzes.findById(quizId)
          if (quizData) {
            let content = `End of lesson quiz ${quizIndex + 1}/${lessonData.quizzes.length}\n\nQuestion:\n${convertToWhatsAppString(he.decode(quizData.question))}\n\nChoices: \nA: ${quizData.choices[0]} \nB: ${quizData.choices[1]} \nC: ${quizData.choices[2]}`
            flow.push({
              type: CourseFlowMessageType.QUIZ,
              content,
              lesson: lessonData,
              quiz: quizData
            })
          }

          quizIndex++
        }
        // add score card for the quizes
        if (lessonData.quizzes.length > 0) {
          flow.push({
            type: CourseFlowMessageType.ENDQUIZ,
            content: `Congratulations on finishing the assessment 🥳! Let’s see how well you did 🌚\n\nYou scored: {score}% in this lesson 🏆\nYou are currently ranked #{course_rank} in this course 🏅\nYour course progress: {progress}% ⏱\n\nIn a few seconds, you will see a leaderboard showing the top performers in this course.
          `
          })
        }
        // add intro to the next lesson
        const nextLesson = course.lessons[lessonIndex + 1]
        if (nextLesson) {
          lessonData = await Lessons.findById(nextLesson)
          if (lessonData) {
            flow.push({
              type: CourseFlowMessageType.ENDLESSON,
              content: `*Next lesson*: ${lessonData.title}\n\n➡️ Tap 'Continue Now' when you're ready to start.\n\nTap 'Continue Tomorrow' to continue tomorrow at \n\nTap 'Set Resumption Time' to choose the time to continue tomorrow.
            `
            })
          }
        }
      }
      lessonIndex++
    }
    let load = {
      type: CourseFlowMessageType.ENDCOURSE,
      content: `That was the last lesson 🎊\n\nWell done on finishing the course 🤝\n\nYou’ll be getting your certificate 📄 soon so that you can brag about it😎 `
    }
    if (course.survey) {
      load.content = load.content + `but first, we want to get your feedback on the course.\n\nWe’ll be sending you a quick survey next 🔎`
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

export const sendMessage = async function (message: Message) {
  axios.post(`https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`, message, {
    headers: {
      "Authorization": `Bearer ${config.whatsapp.token}`,
      "Content-Type": "application/json"
    }
  }).catch((error) => logger.info(error.response.data)).then((data) => logger.info(JSON.stringify((data as AxiosResponse).data)))
}

export const sendBlockContent = async (data: CourseFlowItem, phoneNumber: string, messageId: string): Promise<void> => {
  try {
    let buttons: ReplyButton[] = []
    if (data.type === CourseFlowMessageType.BLOCK) {
      buttons.push({
        type: "reply",
        reply: {
          id: CONTINUE + `|${messageId}`,
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
  const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${courseId}`
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
    console.log(pattern)
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


export const sendQuiz = async (item: CourseFlowItem, phoneNumber: string, messageId: string): Promise<void> => {
  try {
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

export const sendMultiSurvey = async (item: CourseFlowItem, phoneNumber: string, messageId: string): Promise<void> => {
  try {
    if (item.surveyQuestion) {
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

export const sendFreeformSurvey = async (item: CourseFlowItem, phoneNumber: string, _: string): Promise<void> => {
  try {
    if (item.surveyQuestion) {
      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
        to: phoneNumber,
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

export const sendWelcome = async (currentIndex: string, phoneNumber: string): Promise<void> => {
  try {
    if (redisClient.isReady) {
      const courseKey = `${config.redisBaseKey}courses:${currentIndex}`
      const courseFlow = await redisClient.get(courseKey)
      if (courseFlow) {
        const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
        const item = courseFlowData[0]
        if (item) {
          let payload: Message = {
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
        }
      }
    }
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
    const currentItem = flowData[nextIndex - 1]
    if (currentItem && currentItem.type === CourseFlowMessageType.BLOCK) {
      // calculate the elapsed time and update stats service
    }
    let item = flowData[nextIndex]
    if (item) {
      const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${data?.id}`
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
                        id: CONTINUE + `|${messageId}`,
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
            const rank = rankings.findIndex(e => e.phoneNumber === phoneNumber)
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
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
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break

          case CourseFlowMessageType.ENDCOURSE:
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
              type: "text",
              messaging_product: "whatsapp",
              recipient_type: "individual",
              text: {
                body: item.content.replace('{survey}', '')
              }
            })
            let next = flowData[nextIndex + 1]
            if (next?.surveyId && next.surveyQuestion) {
              updatedData = { ...updatedData, nextBlock: updatedData.nextBlock + 1, currentBlock: nextIndex + 1 }
              handleContinue(nextIndex + 1, courseKey, phoneNumber, v4(), updatedData)
            } else {
              // if no survey for this course, then send the certificate
              await delay(5000)
              agenda.now<CourseEnrollment>(SEND_CERTIFICATE, {
                ...updatedData
              })
            }

            break
          case CourseFlowMessageType.ENDLESSON:
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
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.QUIZ:
            await sendQuiz(item, phoneNumber, messageId)
            updatedData = { ...updatedData, quizAttempts: 0, blockStartTime: new Date() }
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.INTRO:
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
              type: "interactive",
              messaging_product: "whatsapp",
              recipient_type: "individual",
              interactive: {
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
                        id: CONTINUE + `|${messageId}`,
                        title: "Continue"
                      }
                    }
                  ]
                }
              }
            })
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.BLOCK:
          case CourseFlowMessageType.BLOCKWITHQUIZ:
            await sendBlockContent(item, phoneNumber, messageId)
            updatedData = { ...updatedData, blockStartTime: new Date() }
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.SURVEY_MULTI_CHOICE:
            await sendMultiSurvey(item, phoneNumber, messageId)
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break
          case CourseFlowMessageType.SURVEY_FREE_FORM:
            await sendFreeformSurvey(item, phoneNumber, messageId)
            saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
            break

          case CourseFlowMessageType.END_SURVEY:
            agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
              to: phoneNumber,
              type: "text",
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
        redisClient.set(key, JSON.stringify({ ...updatedData }))
      }
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
                id: CONTINUE + `|${messageId}`,
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
      if (data.blockStartTime) {
        const diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
        saveBlockDuration(data.team, data.student, diffInSeconds, item.lesson, item.block)
        updatedData = { ...updatedData, blockStartTime: null }
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
                id: CONTINUE + `|${messageId}`,
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
              const diffInSeconds = moment().diff(moment(data.blockStartTime), 'seconds')
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
      agenda.now<Message>(SEND_WHATSAPP_MESSAGE, payload)
    }
  }
}

export const handleSurveyMulti = async (answer: number, data: CourseEnrollment, phoneNumber: string, messageId: string): Promise<void> => {
  const courseKey = `${config.redisBaseKey}courses:${data.id}`
  const courseFlow = await redisClient.get(courseKey)
  const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${data?.id}`
  if (courseFlow) {
    const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
    const item = courseFlowData[data.currentBlock - 1]
    if (item && item.surveyId) {
      // save the survey response
      if (item.surveyQuestion) {
        await SurveyResponse.create({
          survey: item.surveyId,
          team: data.team,
          surveyQuestion: item.surveyQuestion.id,
          course: data.id,
          student: data.student,
          response: item.surveyQuestion.choices[answer],
          responseType: ResponseType.MULTI_CHOICE
        })
      }
      // check if the next block is a survey
      let nextBlock = courseFlowData[data.currentBlock]
      if (nextBlock) {
        if (nextBlock.surveyId) {
          // if next block is survey, check if it is multi-choice survey or freeform
          if (nextBlock.type === CourseFlowMessageType.SURVEY_MULTI_CHOICE) {
            // if it is multi, send multi survey
            sendMultiSurvey(nextBlock, phoneNumber, messageId)
          } else {
            // else send freeform
            sendFreeformSurvey(nextBlock, phoneNumber, messageId)
          }
          // update redis and rtdb
          saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
          let updatedData: CourseEnrollment = { ...data, lastMessageId: messageId, currentBlock: data.currentBlock + 1, nextBlock: data.nextBlock + 1 }
          redisClient.set(key, JSON.stringify({ ...updatedData }))
        } else if (nextBlock.type === CourseFlowMessageType.END_SURVEY) {
          handleContinue(data.currentBlock, courseKey, phoneNumber, v4(), data)
        }
      }
    }
  }
}



export const handleSurveyFreeform = async (answer: string, data: CourseEnrollment, phoneNumber: string, messageId: string): Promise<void> => {
  const courseKey = `${config.redisBaseKey}courses:${data.id}`
  const courseFlow = await redisClient.get(courseKey)
  const key = `${config.redisBaseKey}enrollments:${phoneNumber}:${data?.id}`
  if (courseFlow) {
    const courseFlowData: CourseFlowItem[] = JSON.parse(courseFlow)
    const item = courseFlowData[data.currentBlock - 1]
    if (item && item.surveyId) {
      // save the survey response
      if (item.surveyQuestion) {
        await SurveyResponse.create({
          survey: item.surveyId,
          team: data.team,
          surveyQuestion: item.surveyQuestion.id,
          course: data.id,
          student: data.student,
          response: answer,
          responseType: ResponseType.FREE_FORM
        })
      }
      // check if the next block is a survey
      let nextBlock = courseFlowData[data.currentBlock]
      if (nextBlock) {
        if (nextBlock.surveyId) {
          // if next block is survey, check if it is multi-choice survey or freeform
          if (nextBlock.type === CourseFlowMessageType.SURVEY_MULTI_CHOICE) {
            // if it is multi, send multi survey
            sendMultiSurvey(nextBlock, phoneNumber, messageId)
          } else {
            // else send freeform
            sendFreeformSurvey(nextBlock, phoneNumber, messageId)
          }
          // update redis and rtdb
          saveCourseProgress(data.team, data.student, data.id, (data.currentBlock / data.totalBlocks) * 100)
          let updatedData: CourseEnrollment = { ...data, lastMessageId: messageId, currentBlock: data.currentBlock + 1, nextBlock: data.nextBlock + 1 }
          redisClient.set(key, JSON.stringify({ ...updatedData }))
        } else if (nextBlock.type === CourseFlowMessageType.END_SURVEY) {
          handleContinue(data.currentBlock, courseKey, phoneNumber, v4(), data)
        }
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

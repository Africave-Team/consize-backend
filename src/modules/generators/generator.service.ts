import puppeteer from 'puppeteer'
import { uploadFileToCloudStorage } from '../upload/service.upload'
import { BoardMember, GenerateCertificatePayload, GenerateLeaderboardPayload } from './generator.interfaces'
import { StudentCourseStats, StudentInterface } from '../students/interface.students'
import { CourseInterface } from '../courses/interfaces.courses'
import { TeamsInterface } from '../teams/interfaces.teams'
import db from "../rtdb"
import { existsSync, mkdirSync, unlinkSync } from "fs"
import path from "path"
import Teams from '../teams/model.teams'
import { COURSE_STATS } from '../rtdb/nodes'
import { v4 } from 'uuid'
import { Storage } from '@google-cloud/storage'
import ffmpeg from 'fluent-ffmpeg'
import serviceAccount from '../../gcp-details.json'
import { agenda } from '../scheduler'
import config from '../../config/config'
import { CourseFlowItem, CourseFlowMessageType, handleContinue } from '../webhooks/service.webhooks'
import { CourseEnrollment, Message } from '../webhooks/interfaces.webhooks'
import { SEND_SLACK_MESSAGE, SEND_SLACK_RESPONSE, SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { fetchSignatures } from '../signatures/service.signatures'
import { completeCourse } from '../students/students.service'
import { redisClient } from '../redis'
import { MessageBlockType, SendSlackMessagePayload, SendSlackResponsePayload, SlackTextMessageTypes } from '../slack/interfaces.slack'
import { handleContinueSlack } from '../slack/slack.services'
import Students from '../students/model.students'
import Courses from '../courses/model.courses'
import Settings from '../courses/model.settings'
import { CourseSettingsInterface } from '../courses/interfaces.settings'
import { Certificates } from '../certificates'

const projectRoot = process.cwd()
const localVideoPath = path.join(projectRoot, 'generated-files')
const localThumbnailPath = path.join(projectRoot, "generated-files")


export function delay (ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export const sendCourseLeaderboard = async (courseId: string, studentId: string, enrollment: CourseEnrollment): Promise<void> => {
  const student = await Students.findById(studentId)
  const course = await Courses.findById(courseId)
  if (course && student) {
    const owner = await Teams.findById(course.owner)
    if (owner) {
      const leaderboardUrl = await generateCourseLeaderboard(course, student, owner)
      if (leaderboardUrl.includes('https://')) {
        // send media message with continue button
        agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
          to: student.phoneNumber,
          team: enrollment.team,
          type: "image",
          messaging_product: "whatsapp",
          recipient_type: "individual",
          image: {
            link: leaderboardUrl
          }
        })

        // let buttons: ReplyButton[] = [
        //   {
        //     type: "reply",
        //     reply: {
        //       id: "MAKE_IT_WORK",
        //       title: "Let's continue"
        //     }
        //   }
        // ]
        // let payload: Message = {
        //   to: student.phoneNumber,
        //   type: "interactive",
        //   messaging_product: "whatsapp",
        //   recipient_type: "individual",
        //   interactive: {
        //     body: {
        //       text: "Here is the current leaderboard. It shows your current ranking along with the top 10 students of this course"
        //     },
        //     type: "button",
        //     action: {
        //       buttons
        //     }
        //   }
        // }

        // if (payload.interactive) {
        //   payload.interactive['header'] = {
        //     type: MediaType.IMAGE
        //   }
        //   if (payload.interactive.header) {
        //     payload.interactive.header.image = {
        //       link: leaderboardUrl
        //     }
        //   }
        // }

        // // update the blockStartTime

        // agenda.now<Message>(SEND_WHATSAPP_MESSAGE, payload)
      }
    }
    let msgId = v4()
    await delay(5000)
    await handleContinue(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, student.phoneNumber, msgId, enrollment)
  }
}


export const sendCourseLeaderboardSlack = async (courseId: string, studentId: string, enrollment: CourseEnrollment, url: string): Promise<void> => {
  const student = await Students.findById(studentId)
  const course = await Courses.findById(courseId)
  if (course && student && student.channelId) {
    const owner = await Teams.findById(course.owner)
    if (owner) {
      const leaderboardUrl = await generateCourseLeaderboard(course, student, owner)
      if (leaderboardUrl.includes('https://')) {
        agenda.now<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, {
          url,
          message: {
            blocks: [
              {
                type: MessageBlockType.IMAGE,
                image_url: leaderboardUrl,
                alt_text: "Course leaderboard"
              }
            ]
          }
        })
      }
    }
    let msgId = v4()
    await delay(5000)
    await handleContinueSlack(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, student.channelId, url, msgId, enrollment)
  }
}

export const generateCourseLeaderboard = async (course: CourseInterface, student: StudentInterface, owner: TeamsInterface): Promise<string> => {

  try {
    let launchConfig: { args: any[], executablePath?: string } = {
      args: ['--no-sandbox']
    }
    if (config.server !== "local") {
      launchConfig['executablePath'] = '/usr/bin/chromium-browser'
    }
    console.log("Launching Browser ")
    const browser = await puppeteer.launch(launchConfig)
    console.log("Browser launched")
    const timestamp = new Date().getTime()
    const page = await browser.newPage()
    const url = await generateCourseLeaderboardURL(course, student, owner)
    await page.goto(url, { waitUntil: "networkidle0" })
    await page.setViewport({
      width: 1920, height: 1080, deviceScaleFactor: 2
    })
    const divSelector = '.leaderboard' // Replace with your actual div selector
    await page.waitForSelector(divSelector)
    const divHandle = await page.$(divSelector)

    const screenshotPromise = new Promise<Buffer>(async (resolve, reject) => {
      try {
        if (divHandle) {
          const boundingBox = await divHandle.boundingBox()

          if (boundingBox) {
            const imageBuffer = await page.screenshot({
              clip: {
                x: boundingBox.x,
                y: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            })
            console.log('Screenshot saved')
            resolve(imageBuffer)
          } else {
            console.error('Div not found or not visible')
            reject(new Error('Div not found or not visible'))
          }
        }
      } catch (error) {
        console.error('Error capturing screenshot:', error)
        reject(error)
      }
    })

    const imageBuffer = await screenshotPromise
    let destination = `microlearn-leaderboard-images/${course.id}-${student.id}-${timestamp}.png`
    if (imageBuffer) {
      console.log("attempting upload")
      await page.close()
      await browser.close()
      return await uploadFileToCloudStorage(imageBuffer, destination)
    }
    return ''
  } catch (error) {
    console.log(error)
    return ''
  }
}


export const generateCourseLeaderboardURL = async (course: CourseInterface, student: StudentInterface, owner: TeamsInterface): Promise<string> => {
  const dbRef = db.ref(COURSE_STATS).child(owner.id).child(course.id).child("students")
  // get existing data
  const flow = await redisClient.get(`${config.redisBaseKey}courses:${course.id}`)
  let totalQuiz = 1
  if (flow) {
    const flowData: CourseFlowItem[] = JSON.parse(flow)
    totalQuiz = flowData.filter(e => e.type === CourseFlowMessageType.QUIZ).length
  }
  const snapshot = await dbRef.once('value')
  let data: { [id: string]: StudentCourseStats } | null = snapshot.val()
  let rankings: BoardMember[] = [], finalRankings: BoardMember[] = []
  if (data) {
    rankings = Object.values(data).map(student => {
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
      return (((b.totalScore || 0) * 100) / totalQuiz) - (((a.totalScore || 0) * 100) / totalQuiz)
    }).map((std: StudentCourseStats, index: number) => {
      let score = 0
      if (std.totalScore) {
        score = std.totalScore
        if (score > 0) {
          score = (score * 100) / totalQuiz
        }
      }
      return {
        name: std.name,
        isCurrentUser: student.id === std.studentId,
        rank: index + 1,
        score
      }
    })
    let current = rankings.find(e => e.isCurrentUser)
    finalRankings = rankings.slice(0, 10)
    if (current) {
      if (current.rank > 10) {
        finalRankings.push(current)
      }
    }
  }
  let payload: GenerateLeaderboardPayload = {
    studentName: `${student.firstName} ${student.otherNames}`,
    courseName: course.title,
    organizationName: owner.name,
    leaderboard: finalRankings
  }
  const query = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')

  return `${config.clientUrl}/templates/leaderboard?data=${query}`
}

export const generateCourseCertificateURL = async (course: CourseInterface, student: StudentInterface, owner: TeamsInterface, settings: CourseSettingsInterface): Promise<string> => {
  const signatories = await fetchSignatures(owner.id)
  let payload: GenerateCertificatePayload = {
    studentName: `${student.firstName} ${student.otherNames}`,
    courseName: course.title,
    logoUrl: owner.logo || null,
    organizationName: owner.name,
    signatory1: "Pelumi Ogboye",
    signatory2: "Ifeanyi Perry",
    signature1: "Pelumi Ogboye",
    signature2: "Ifeanyi Perry"
  }
  if (signatories.length > 0) {
    let first = signatories[0]
    let second = signatories[1]
    if (first) {
      payload.signatory1 = first.name
      payload.signature1 = first.signature || first.name
    }

    if (second) {
      payload.signatory2 = second.name
      payload.signature2 = second.signature || second.name
    }
  }
  if (settings.certificateId) {
    payload.certificateId = settings.certificateId
  } else {
    if (owner.defaultCertificateId) {
      payload.certificateId = owner.defaultCertificateId
    } else {
      payload.certificateId = v4()
    }
  }
  const certificate = await Certificates.findById(payload.certificateId)
  if (certificate) {
    if (certificate.components && certificate.components.components.length > 0) {
      payload.template = false
    } else {
      payload.template = true
    }
  } else {
    payload.template = true
  }
  console.log(payload, "CERTIFICATE PAYLOAD")

  const query = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')

  return `${config.clientUrl}/templates/certificate?data=${query}`
}



export const sendCourseCertificate = async (courseId: string, studentId: string): Promise<void> => {
  const student = await Students.findById(studentId)
  const course = await Courses.findById(courseId)
  if (course && student) {
    const settings = await Settings.findById(course.settings)
    const owner = await Teams.findById(course.owner)
    if (owner && settings) {
      const url = await generateCourseCertificate(course, student, owner, settings)
      completeCourse(course.owner, studentId, courseId, url)
      if (url.includes('https://')) {
        // send media message with continue button
        if (!settings.disableCertificates) {
          agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
            to: student.phoneNumber,
            team: course.owner,
            type: "image",
            messaging_product: "whatsapp",
            recipient_type: "individual",
            image: {
              link: url
            }
          })
        }
      } else {
        console.log("Failed to generate certificate")
      }
      if (settings) {
        if (settings.courseMaterials.length > 0) {
          agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
            to: student.phoneNumber,
            team: course.owner,
            type: "text",
            messaging_product: "whatsapp",
            recipient_type: "individual",
            text: {
              body: `Congratulations once again. For further reading, please refer to these extra resources.\n\n\n${settings.courseMaterials.map((mat) => `${mat.fileName}\n${mat.fileUrl}`).join('\n\n\n')}`
            },
          })
        }
      }

    }

    await delay(15000)
    agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
      to: student.phoneNumber,
      team: course.owner,
      type: "interactive",
      messaging_product: "whatsapp",
      recipient_type: "individual",
      interactive: {
        body: {
          text: `To search through completed courses, type "Search" or Tap the button below`
        },
        type: "button",
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: "search",
                title: "Search"
              }
            }
          ]
        }
      }
    })
  }
}

export const sendCourseCertificateSlack = async (courseId: string, studentId: string): Promise<void> => {
  const student = await Students.findById(studentId)
  const course = await Courses.findById(courseId)
  if (course && student) {
    const settings = await Settings.findById(course.settings)
    const owner = await Teams.findById(course.owner)
    if (owner && owner.slackToken && settings) {
      if (!settings.disableCertificates) {
        const url = await generateCourseCertificate(course, student, owner, settings)
        completeCourse(course.owner, studentId, courseId, url)
        if (url.includes('https://')) {
          // send media message with continue button
          agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
            accessToken: owner.slackToken,
            channel: student.channelId,
            message: {
              blocks: [
                {
                  type: MessageBlockType.IMAGE,
                  image_url: url,
                  alt_text: "Student course certificate"
                }
              ]
            }
          })
        } else {
          console.log("Failed to generate certificate")
        }
      }
      if (settings) {
        if (settings.courseMaterials.length > 0) {
          agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
            accessToken: owner.slackToken,
            channel: student.channelId,
            message: {
              blocks: [
                {
                  type: MessageBlockType.SECTION,
                  text: {
                    type: SlackTextMessageTypes.MARKDOWN,
                    text: `Congratulations once again. For further reading, please refer to these extra resources.\n\n\n${settings.courseMaterials.map((mat) => `${mat.fileName}\n${mat.fileUrl}`).join('\n\n\n')}`
                  },
                }
              ]
            }
          })
        }
      }
    }
  }
}

export const generateCourseCertificate = async (course: CourseInterface, student: StudentInterface, owner: TeamsInterface, settings: CourseSettingsInterface): Promise<string> => {
  try {
    // get existing data
    let launchConfig: { args: any[], executablePath?: string } = {
      args: ['--no-sandbox']
    }
    if (config.server !== "local") {
      launchConfig['executablePath'] = '/usr/bin/chromium-browser'
    }
    const browser = await puppeteer.launch(launchConfig)
    const timestamp = new Date().getTime()
    const page = await browser.newPage()
    const url = await generateCourseCertificateURL(course, student, owner, settings)
    await page.goto(url, { waitUntil: "networkidle0" })
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2, })
    const divSelector = '.template' // Replace with your actual div selector
    await page.waitForSelector(divSelector)
    const divHandle = await page.$(divSelector)

    const screenshotPromise = new Promise<Buffer>(async (resolve, reject) => {
      try {
        if (divHandle) {
          const boundingBox = await divHandle.boundingBox()

          if (boundingBox) {
            const imageBuffer = await page.screenshot({
              clip: {
                x: boundingBox.x,
                y: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            })
            console.log('Screenshot saved')
            resolve(imageBuffer)
          } else {
            console.error('Div not found or not visible')
            reject(new Error('Div not found or not visible'))
          }
        }
      } catch (error) {
        console.error('Error capturing screenshot:', error)
        reject(error)
      }
    })

    const imageBuffer = await screenshotPromise
    let destination = `microlearn-certificate-images/${course.id}-${student.id}-${timestamp}.png`
    if (imageBuffer) {
      console.log("attempting upload")
      await page.close()
      await browser.close()
      return await uploadFileToCloudStorage(imageBuffer, destination)
    }
    return ''
  } catch (error) {
    console.log(error)
    return ''
  }
}


export const generateCourseHeaderURL = async (course: CourseInterface, owner: TeamsInterface): Promise<string> => {
  let payload: {
    courseName: string
    organizationName: string
    description: string
  } = {
    courseName: course.title,
    organizationName: owner.name,
    description: course.description
  }

  const query = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')

  return `${config.clientUrl}/templates/course-header?data=${query}`
}

export const generateCourseHeaderImage = async (course: CourseInterface, owner: TeamsInterface): Promise<string> => {
  try {
    // get existing data
    let launchConfig: { args: any[], executablePath?: string } = {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
    if (config.server !== "local") {
      launchConfig['executablePath'] = '/usr/bin/chromium-browser'
    }
    const browser = await puppeteer.launch(launchConfig)
    const timestamp = new Date().getTime()
    const page = await browser.newPage()
    const url = await generateCourseHeaderURL(course, owner)
    await page.goto(url, { waitUntil: "networkidle0" })
    await page.setViewport({
      width: 1440,
      height: 700,
      deviceScaleFactor: 1
    })
    const divSelector = '.course-header' // Replace with your actual div selector
    await page.waitForSelector(divSelector)
    const divHandle = await page.$(divSelector)

    const screenshotPromise = new Promise<Buffer>(async (resolve, reject) => {
      try {
        if (divHandle) {
          const boundingBox = await divHandle.boundingBox()

          if (boundingBox) {
            const imageBuffer = await page.screenshot({
              clip: {
                x: boundingBox.x,
                y: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            })
            console.log('Screenshot saved')
            resolve(imageBuffer)
          } else {
            console.error('Div not found or not visible')
            reject(new Error('Div not found or not visible'))
          }
        }
      } catch (error) {
        console.error('Error capturing screenshot:', error)
        reject(error)
      }
    })

    const imageBuffer = await screenshotPromise
    let destination = `microlearn-certificate-images/${timestamp + '-header-image.png'}`
    if (imageBuffer) {
      console.log("attempting upload")
      await page.close()
      await browser.close()
      return await uploadFileToCloudStorage(imageBuffer, destination)
    }
    return ''
  } catch (error) {
    console.log(error)
    return ''
  }
}

async function downloadFile (url: string) {
  const options = {
    destination: localVideoPath + '/video.mp4',
  }
  const storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key?.split(String.raw`\n`).join("\n"),
    },
  })

  const bucketName = 'kippa-cdn-public'
  let [_, destination] = decodeURI(url).split(`/${bucketName}/`)
  if (destination) {
    await storage.bucket(bucketName).file(destination).download(options)
    console.log(`Downloaded ${destination} to ${localVideoPath}`)
  }
}

export async function downloadFileToDir (url: string, dir: string) {
  const options = {
    destination: dir + (url.replace('https://storage.googleapis.com/kippa-cdn-public/', '').split('/')[1]),
  }
  console.log(options)
  const storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key?.split(String.raw`\n`).join("\n"),
    },
  })

  const bucketName = 'kippa-cdn-public'
  let [_, destination] = decodeURI(url).split(`/${bucketName}/`)
  if (destination) {
    await storage.bucket(bucketName).file(destination).download(options)
    console.log(`Downloaded ${destination} to ${options.destination}`)
  }
}

async function createThumbnail () {
  return new Promise((resolve, reject) => {
    ffmpeg(localVideoPath + "/video.mp4")
      .screenshots({
        timestamps: ['00:00:10.000'],
        filename: 'thumbnail.png',
        folder: localThumbnailPath,
        count: 1,
        size: '320x240'
      })
      .on('end', (data) => {
        console.log(data, "finished")
        resolve(data)
      })
      .on('error', (error: any) => {
        console.log(error, "error")
        reject(error)
      })
  })
}

export const generateVideoThumbnail = async function (fileUrl: string): Promise<string> {
  let thumbailUrl = ""
  try {
    if (!existsSync(localVideoPath)) {
      mkdirSync(localVideoPath)
    }
    await downloadFile(fileUrl)
    if (!existsSync(localThumbnailPath)) {
      mkdirSync(localThumbnailPath)
    }
    await createThumbnail()

    const storage = new Storage({
      projectId: serviceAccount.project_id,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key?.split(String.raw`\n`).join("\n"),
      },
    })

    if (existsSync(localThumbnailPath + "/thumbnail.png")) {
      const bucketName = 'kippa-cdn-public'
      let [_, destination] = fileUrl.split(`/${bucketName}/`)
      if (!destination) {
        destination = "microlearn-images/thumbnail.png"
      } else {
        destination = `${destination.replace('mp4', 'png')}`
      }
      await storage.bucket(bucketName).upload(localThumbnailPath + '/thumbnail.png', {
        destination: destination,
      })
      thumbailUrl = encodeURI(`https://storage.googleapis.com/kippa-cdn-public/${destination}`)
    }
    if (existsSync(localVideoPath + "/video.mp4")) {
      unlinkSync(localVideoPath + "/video.mp4")
    }
    if (existsSync(localThumbnailPath + "/thumbnail.png")) {
      unlinkSync(localThumbnailPath + "/thumbnail.png")
    }
    return thumbailUrl
  } catch (error) {
    if (existsSync(localVideoPath + "/video.mp4")) {
      unlinkSync(localVideoPath + "/video.mp4")
    }
    if (existsSync(localThumbnailPath + "/thumbnail.png")) {
      unlinkSync(localThumbnailPath + "/thumbnail.png")
    }
    return thumbailUrl
  }
}
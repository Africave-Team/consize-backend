import puppeteer from 'puppeteer'
import { Student } from '../students'
import { uploadFileToCloudStorage } from '../upload/service.upload'
import { BoardMember, GenerateCertificatePayload, GenerateLeaderboardPayload } from './generator.interfaces'
import { StudentCourseStats, StudentInterface } from '../students/interface.students'
import { CourseInterface } from '../courses/interfaces.courses'
import { TeamsInterface } from '../teams/interfaces.teams'
import { Course } from '../courses'
import db from "../rtdb"
import Teams from '../teams/model.teams'
import { COURSE_STATS } from '../rtdb/nodes'
import { v4 } from 'uuid'
import { agenda } from '../scheduler'
import config from '../../config/config'
import { handleContinue } from '../webhooks/service.webhooks'
import { CourseEnrollment, Message } from '../webhooks/interfaces.webhooks'
import { SEND_WHATSAPP_MESSAGE } from '../scheduler/MessageTypes'
import { fetchSignatures } from '../signatures/service.signatures'
import { completeCourse } from '../students/students.service'


export function delay (ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export const sendCourseLeaderboard = async (courseId: string, studentId: string, enrollment: CourseEnrollment): Promise<void> => {
  const student = await Student.findById(studentId)
  const course = await Course.findById(courseId)
  if (course && student) {
    const owner = await Teams.findById(course.owner)
    if (owner) {
      const leaderboardUrl = await generateCourseLeaderboard(course, student, owner)
      if (leaderboardUrl.includes('https://')) {
        // send media message with continue button
        agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
          to: student.phoneNumber,
          type: "image",
          messaging_product: "whatsapp",
          recipient_type: "individual",
          image: {
            link: leaderboardUrl
          }
        })
      }
    }
    let msgId = v4()
    await delay(5000)
    await handleContinue(enrollment.nextBlock, `${config.redisBaseKey}courses:${enrollment.id}`, student.phoneNumber, msgId, enrollment)
  }
}

export const generateCourseLeaderboard = async (course: CourseInterface, student: StudentInterface, owner: TeamsInterface): Promise<string> => {
  const dbRef = db.ref(COURSE_STATS).child(owner.id).child(course.id).child("students")
  // get existing data
  const snapshot = await dbRef.once('value')
  let data: { [id: string]: StudentCourseStats } | null = snapshot.val()
  let rankings: BoardMember[] = []
  if (data) {
    rankings = Object.values(data).sort((a: StudentCourseStats, b: StudentCourseStats) => {
      const first = a.scores.reduce((a, b) => a + b, 0)
      const second = b.scores.reduce((a, b) => a + b, 0)
      return second - first
    }).map((std: StudentCourseStats, index: number) => {
      return {
        name: std.name,
        isCurrentUser: student.phoneNumber === std.phoneNumber,
        rank: index + 1,
        score: std.scores.reduce((a, b) => a + b, 0)
      }
    })
  }
  let launchConfig: { args: any[], executablePath?: string } = {
    args: ['--no-sandbox']
  }
  if (config.server !== "local") {
    launchConfig['executablePath'] = '/usr/bin/chromium-browser'
  }
  const browser = await puppeteer.launch(launchConfig)
  const timestamp = new Date().getTime()
  const page = await browser.newPage()
  let payload: GenerateLeaderboardPayload = {
    studentName: `${student.firstName} ${student.otherNames}`,
    courseName: course.title,
    organizationName: owner.name,
    leaderboard: rankings
  }
  const query = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')
  await page.goto(`https://consize.com/templates/leaderboard?data=${query}`, { waitUntil: "networkidle0" })
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
}



export const sendCourseCertificate = async (courseId: string, studentId: string): Promise<void> => {
  const student = await Student.findById(studentId)
  const course = await Course.findById(courseId)
  if (course && student) {
    const owner = await Teams.findById(course.owner)
    if (owner) {
      const url = await generateCourseCertificate(course, student, owner)
      if (url.includes('https://')) {
        // send media message with continue button
        completeCourse(course.owner, studentId, courseId, url)
        agenda.now<Message>(SEND_WHATSAPP_MESSAGE, {
          to: student.phoneNumber,
          type: "image",
          messaging_product: "whatsapp",
          recipient_type: "individual",
          image: {
            link: url
          }
        })
      }
    }
  }
}

export const generateCourseCertificate = async (course: CourseInterface, student: StudentInterface, owner: TeamsInterface): Promise<string> => {
  // get existing data
  let launchConfig: { args: any[], executablePath?: string } = {
    args: ['--no-sandbox']
  }
  if (config.server !== "local") {
    launchConfig['executablePath'] = '/usr/bin/chromium-browser'
  }
  const browser = await puppeteer.launch(launchConfig)
  // get the signatories
  const signatories = await fetchSignatures(owner.id)
  const timestamp = new Date().getTime()
  const page = await browser.newPage()
  let payload: GenerateCertificatePayload = {
    studentName: `${student.firstName} ${student.otherNames}`,
    courseName: course.title,
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
      payload.signature1 = first.name
    }

    if (second) {
      payload.signatory2 = second.name
      payload.signature2 = second.name
    }
  }
  const query = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')
  await page.goto(`https://consize.com/templates/certificate?data=${query}`, { waitUntil: "networkidle0" })
  await page.setViewport({
    width: 1920, height: 1080, deviceScaleFactor: 2
  })
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
}
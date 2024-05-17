import OpenAI from 'openai'
import db from "../rtdb"
import config from '../../config/config'
import moment from 'moment'
import { JobData } from './interfaces'
import { courseService } from '../courses'
import { MediaType } from '../courses/interfaces.courses'
const openai = new OpenAI({
  apiKey: config.openAI.key
})


export const buildCourseOutline = async function (payload: { courseId: string, prompt: string, title: string, lessonCount: number }) {
  try {
    const today = moment().format('DD-MM-YYYY')
    const dbRef = db.ref("ai-jobs").child(today)
    await dbRef
      .child(payload.courseId)
      .set({
        status: "RUNNING",
        title: payload.title,
        lessonCount: payload.lessonCount,
        result: null,
        error: null,
        start: new Date().toISOString(),
        end: null
      })
    const MAX_RETRIES = 3

    const openAICall = async (retries: number, cb: (data: OpenAI.Chat.Completions.ChatCompletion) => void) => {
      try {
        const data = await openai.chat.completions.create({
          messages: [{ "role": "system", "content": "You are a helpful assistant." },
          { "role": "user", "content": payload.prompt }],
          model: "gpt-3.5-turbo",
        })
        await dbRef
          .child(payload.courseId)
          .update({
            status: "FINISHED",
            end: new Date().toISOString()
          })
        cb(data)
      } catch (error) {
        if (retries < MAX_RETRIES) {
          await dbRef
            .child(payload.courseId)
            .update({
              status: "RETRYING",
              error: (error as any).error.message
            })
          openAICall(retries + 1, cb)
        } else {
          await dbRef
            .child(payload.courseId)
            .update({
              status: "FAILED",
              error: (error as any).error.message,
              end: new Date().toISOString()
            })
        }
      }
    }

    const handleRequestComplete = async (data: OpenAI.Chat.Completions.ChatCompletion) => {
      if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        await dbRef
          .child(payload.courseId)
          .update({
            result: JSON.parse(data.choices[0].message.content),
          })
      }
    }
    openAICall(0, handleRequestComplete)
  } catch (error) {

  }
}

export const buildCourse = async function (jobId: string, teamId: string) {
  const today = moment().format('DD-MM-YYYY')
  const dbRef = db.ref('ai-jobs').child(today).child(jobId)
  const snapshot = await dbRef.once('value')

  const jobData: JobData | null = snapshot.val()
  if (jobData) {
    // create the course
    const course = await courseService.createCourse({
      title: jobData.title,
      headerMedia: {
        mediaType: MediaType.IMAGE,
        url: "https://picsum.photos/200/300.jpg?image=0",
        awsFileKey: ""
      },
      bundle: false,
      private: false,
      free: true,
      description: jobData.result.description
    }, teamId)
    let lessons = jobData.result.lessons
    for (let lesson of Object.values(lessons)) {

    }
    // for each lesson, create the lesson, then queue the section builder ai
    // log the running status of 
    // then log the status of that section build on rtdb

  }
}

export const buildLessonSection = async function () { }




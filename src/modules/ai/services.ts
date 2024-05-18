import OpenAI from 'openai'
import db from "../rtdb"
import config from '../../config/config'
import { BuildSectionPayload, QuizAI, JobData, SectionResultAI } from './interfaces'
import { courseService } from '../courses'
import { MediaType, Sources } from '../courses/interfaces.courses'
import { agenda } from '../scheduler'
import { GENERATE_SECTION_AI } from '../scheduler/MessageTypes'
import { generateFollowupQuestionPrompt, generateQuizPrompt, generateSectionPrompt } from '../courses/prompts'
const openai = new OpenAI({
  apiKey: config.openAI.key
})


export const buildCourseOutline = async function (payload: { courseId: string, prompt: string, title: string, lessonCount: number }) {
  try {
    const dbRef = db.ref("ai-jobs")
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
            result: JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", "")),
          })
      }
    }
    openAICall(0, handleRequestComplete)
  } catch (error) {

  }
}

export const buildCourse = async function (jobId: string, teamId: string) {
  const dbRef = db.ref('ai-jobs').child(jobId)
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
      source: Sources.AI,
      bundle: false,
      private: false,
      free: true,
      description: jobData.result.description
    }, teamId)
    await dbRef.update({ courseId: course.id })
    let lessons = jobData.result.lessons
    const progressRef = dbRef.child("progress")
    for (let lesson of Object.values(lessons)) {
      // create the lesson
      const lessonDetail = await courseService.createLesson({
        title: lesson.lesson_name
      }, course.id)
      for (let section of Object.values(lesson.sections)) {
        await progressRef.child(lesson.lesson_name).child(section[0]).set({ status: "RUNNING", courseId: course.id, lessonId: lessonDetail.id })
        agenda.now<BuildSectionPayload>(GENERATE_SECTION_AI, {
          seedContent: section[1],
          seedTitle: section[0],
          lessonId: lessonDetail.id,
          lessonName: lesson.lesson_name,
          jobId,
          title: jobData.title,
          courseId: course.id
        })
      }
    }
    return course
  }
  return null
}

export const buildSection = async function (payload: BuildSectionPayload) {
  const dbRef = db.ref('ai-jobs').child(payload.jobId).child("progress").child(payload.lessonName).child(payload.seedTitle)
  // make the open ai call here

  const MAX_RETRIES = 3

  const openAICall = async (retries: number, prompt: string, cb: (data: OpenAI.Chat.Completions.ChatCompletion) => void) => {
    try {
      const data = await openai.chat.completions.create({
        messages: [{ "role": "system", "content": "You are a helpful assistant." },
        { "role": "user", "content": prompt }],
        model: "gpt-3.5-turbo",
      })
      cb(data)
    } catch (error) {
      if (retries < MAX_RETRIES) {
        await dbRef
          .update({
            status: "RETRYING",
            error: (error as any).error.message
          })
        openAICall(retries + 1, prompt, cb)
      } else {
        await dbRef
          .update({
            status: "FAILED",
            error: (error as any).error.message,
            end: new Date().toISOString()
          })
      }
    }
  }
  function addCharacterAfterThirdFullStop (input: string, character: string) {
    let count = 0
    const result = input.replace(/(\.)/g, (_, p1) => {
      count++
      if (count % 3 === 0) {
        return p1 + character
      }
      return p1
    })
    return result
  }

  let prompt1 = generateSectionPrompt(payload.title, payload.lessonName, payload.seedTitle, payload.seedContent)
  await openAICall(0, prompt1, async (data) => {
    let section: SectionResultAI
    let followupQuiz: QuizAI[] = []
    let quiz: QuizAI[] = []
    let flqId = "", qId = ""
    if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      try {
        section = JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", ""))

        // Replace each emoji with a newline followed by the emoji
        let sectionContent = addCharacterAfterThirdFullStop(section.sectionContent, '<br/><br/>')
        const block = await courseService.createBlock({
          content: sectionContent,
          title: section.sectionName,
        }, payload.lessonId, payload.courseId)
        await dbRef
          .update({
            blockId: block.id
          })
        let prompt2 = generateFollowupQuestionPrompt(section.sectionContent)
        let prompt3 = generateQuizPrompt(section.sectionContent)
        await Promise.all([
          await openAICall(0, prompt2, async (data) => {
            if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
              try {
                followupQuiz = JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", "")).questions
                if (followupQuiz && followupQuiz[0]) {
                  let answer = followupQuiz[0].correct_answer
                  let index = followupQuiz[0].options.findIndex((e) => e.toLowerCase() === answer.toLowerCase())
                  const q = await courseService.addBlockQuiz({
                    question: followupQuiz[0].question,
                    choices: followupQuiz[0].options.map(e => e.toLowerCase()),
                    correctAnswerContext: `${followupQuiz[0].explanation}`,
                    correctAnswerIndex: index,
                    revisitChunk: "",
                    wrongAnswerContext: `${followupQuiz[0].explanation}`
                  }, payload.lessonId, payload.courseId, block.id)
                  flqId = q.id
                }
              } catch (error) {
                console.log(error)
              }
            }
          }),
          await openAICall(0, prompt3, async (data) => {
            if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
              try {
                quiz = JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", "")).questions

                if (quiz && quiz[0]) {
                  const dp = await courseService.addLessonQuiz({
                    question: quiz[0].question,
                    choices: quiz[0].options,
                    correctAnswerContext: `${quiz[0].explanation}`,
                    correctAnswerIndex: Number(quiz[0].correct_answer),
                    hint: quiz[0].hint,
                    revisitChunk: quiz[0].explanation,
                    wrongAnswerContext: `${quiz[0].explanation}`
                  }, payload.lessonId, payload.courseId)
                  qId = dp.id
                }
              } catch (error) {
                console.log(error)
              }
            }
          })
        ])

        let result: any = {
          section: { ...section, sectionContent, id: block.id }
        }
        if (followupQuiz[0]) {
          result.followupQuiz = { ...followupQuiz[0], id: flqId }
        }
        if (quiz[0]) {
          result.quiz = { ...quiz[0], id: qId }
        }
        await dbRef
          .update({
            status: "FINISHED",
            result,
            end: new Date().toISOString()
          })
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const buildLessonSection = async function () { }




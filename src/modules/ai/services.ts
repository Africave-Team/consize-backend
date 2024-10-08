import OpenAI from 'openai'
import db from "../rtdb"
import fs from "fs"
import config from '../../config/config'
import { BuildSectionPayload, QuizAI, JobData, SectionResultAI, Curriculum, BuildSectionFromFilePayload, BuildSectionsFromFilePayload } from './interfaces'
import { courseService } from '../courses'
import { CourseInterface, MediaType, Sources } from '../courses/interfaces.courses'
import { agenda } from '../scheduler'
import { GENERATE_SECTION_AI } from '../scheduler/MessageTypes'
import { generateFollowupQuestionPrompt, generateQuizPrompt, generateSectionFilePrompt, generateSectionNoSeedPrompt, generateSectionPrompt, generateSectionsFilePrompt } from '../courses/prompts'
import Courses from '../courses/model.courses'
import Lessons from '../courses/model.lessons'
import { ApiError } from '../errors'
import httpStatus from 'http-status'
import Teams from '../teams/model.teams'
import { delay, generateCourseHeaderImage } from '../generators/generator.service'
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
        try {
          console.log(data.choices[0].message.content)
          let result = JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", ""))
          await dbRef
            .child(payload.courseId)
            .update({
              result,
            })
        } catch (error) {
          await dbRef
            .child(payload.courseId)
            .update({
              status: "FAILED",
              error: (error as any).message
            })
        }
      }
    }
    openAICall(0, handleRequestComplete)
  } catch (error) {

  }
}

const updateCourseHeader = async function (teamId: string, course: CourseInterface) {
  try {
    const team = await Teams.findById(teamId)
    if (team) {
      const headerMedia = await generateCourseHeaderImage(course, team)
      await courseService.updateCourse({
        headerMedia: {
          url: headerMedia,
          mediaType: MediaType.IMAGE
        }
      }, course.id, teamId)
    }
  } catch (error) {
    console.error("Unable to generate header image")
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
        url: "https://picsum.photos/200/300.jpg",
        awsFileKey: ""
      },
      contents: [],
      source: Sources.AI,
      bundle: false,
      private: false,
      free: true,
      description: jobData.result.description
    }, teamId)

    updateCourseHeader(teamId, course)
    await dbRef.update({ courseId: course.id })
    let lessons = jobData.result.lessons
    const progressRef = dbRef.child("progress")
    let index = 0
    for (let lesson of Object.values(lessons)) {
      // create the lesson
      const lessonDetail = await courseService.createLesson({
        title: lesson.lesson_name
      }, course.id)
      let sectionIndex = 0
      for (let section of Object.values(lesson.sections)) {
        await progressRef.child(index + '').child(lesson.lesson_name.replace(/\./g, "")).child(sectionIndex + '').child(section[0].replace(/\./g, "")).set({ status: "RUNNING", courseId: course.id })
        agenda.now<BuildSectionPayload>(GENERATE_SECTION_AI, {
          seedContent: section[1],
          seedTitle: section[0],
          lessonId: lessonDetail.id,
          lessonName: lesson.lesson_name,
          jobId,
          title: jobData.title,
          courseId: course.id,
          sectionIndex,
          lessonIndex: index
        })
        sectionIndex++
      }

      index++
    }
    return course
  }
  return null
}

function addCharacterAfterThirdFullStop (input: string, character: string) {
  let count = 0
  const sections = input.split('.')
  let lastIndex = sections.length - 1
  let lastSection = sections[lastIndex]
  if (lastSection && lastSection.length < 10) {
    input = input.replace(`.${lastSection}`, lastSection)
  }
  const result = input.replace(/(\.)/g, (_, p1) => {
    count++
    if (count % 3 === 0) {
      return p1 + character
    }
    return p1
  })
  return result
}

export const buildSection = async function (payload: BuildSectionPayload) {
  const dbRef = db.ref('ai-jobs').child(payload.jobId).child("progress").child(payload.lessonIndex + '').child(payload.lessonName.replace(/\./g, "")).child(payload.sectionIndex + '').child(payload.seedTitle.replace(/\./g, ""))
  // make the open ai call here

  const handleRetry = async function (retries: number, prompt: string, callback: (data: OpenAI.Chat.Completions.ChatCompletion) => void, error: Error) {
    const maxRetries = 5
    if (retries <= maxRetries) {
      await dbRef.update({
        retryCount: retries + 1,
        status: "RETRYING",
        error: error.message || "Failed to generate this block",
      })
      await delay(3000)
      await openAICall(retries + 1, prompt, callback)
    } else {
      await dbRef.update({
        status: "FAILED",
        error: error.message || "Failed to generate this block",
        end: new Date().toISOString(),
      })
    }
  }

  const openAICall = async (retries: number, prompt: string, cb: (data: OpenAI.Chat.Completions.ChatCompletion) => void) => {
    try {
      const data = await openai.chat.completions.create({
        messages: [{ "role": "system", "content": "You are a helpful assistant." },
        { "role": "user", "content": prompt }],
        model: "gpt-3.5-turbo",
      })
      if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", ''))
      } else {
        throw new Error("no result")
      }
      cb(data)
    } catch (error) {
      handleRetry(retries, prompt, cb, (error as any).message)
    }
  }


  let prompt1 = generateSectionPrompt(payload.title, payload.lessonName, payload.seedTitle, payload.seedContent)
  await openAICall(0,
    prompt1,
    async (data) => {
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
                      block: block.id,
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
    }
  )
}

export const buildLessonSection = async function ({ courseId, lessonId, seedTitle }: { courseId: string, lessonId: string, seedTitle: string }) {
  const course = await Courses.findById(courseId)
  const lesson = await Lessons.findById(lessonId)
  if (!course) throw new ApiError(httpStatus.NOT_FOUND, "Course not found")
  if (!lesson) throw new ApiError(httpStatus.NOT_FOUND, "Course not found")
  const data = await openai.chat.completions.create({
    messages: [{ "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": generateSectionNoSeedPrompt(course.title, lesson.title, seedTitle) }],
    model: "gpt-3.5-turbo",
  })

  if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    let section = JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", ""))
    let sectionContent = addCharacterAfterThirdFullStop(section.sectionContent, '<br/><br/>')
    return { ...section, sectionContent }
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, "Failed to build this section. Try again")
  }
}

export const rewriteLessonSection = async function ({ courseId, lessonId, seedTitle, seedContent }: { courseId: string, lessonId: string, seedTitle: string, seedContent: string }) {
  const course = await Courses.findById(courseId)
  const lesson = await Lessons.findById(lessonId)
  if (!course) throw new ApiError(httpStatus.NOT_FOUND, "Course not found")
  if (!lesson) throw new ApiError(httpStatus.NOT_FOUND, "Course not found")
  const data = await openai.chat.completions.create({
    messages: [{ "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": generateSectionPrompt(course.title, lesson.title, seedTitle, seedContent) }],
    model: "gpt-3.5-turbo",
  })

  if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    let section = JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", ""))
    let sectionContent = addCharacterAfterThirdFullStop(section.sectionContent, '<br/><br/>')
    return { ...section, sectionContent }
  } else {
    throw new Error("Failed to build this section. Try again")
  }
}

export const buildLessonSectionQuiz = async function ({ content, followup }: { content: string, followup: boolean }) {
  const data = await openai.chat.completions.create({
    messages: [{ "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": followup ? generateFollowupQuestionPrompt(content) : generateQuizPrompt(content) }],
    model: "gpt-3.5-turbo",
  })

  if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    let result = JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", "")).questions
    return result[0]
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, "Failed to build this section. Try again")
  }
}

export const rewriteLessonSectionQuiz = async function ({ content, followup }: { followup: boolean, content: string }) {
  const data = await openai.chat.completions.create({
    messages: [{ "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": followup ? generateFollowupQuestionPrompt(content) : generateQuizPrompt(content) }],
    model: "gpt-3.5-turbo",
  })

  if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    let result = JSON.parse(data.choices[0].message.content.replace("```json", '').replace("```", "")).questions
    return result[0]
  } else {
    throw new Error("Failed to build this section. Try again")
  }
}


export const buildSectionsFromFile = async function (payload: BuildSectionsFromFilePayload) {


  const handleRetry = async function (prompt: string, retries: number, sections: [string, string][], callback: (data: any) => Promise<void>, error: Error) {
    const maxRetries = 5
    if (retries <= maxRetries) {

      await Promise.all(sections.map(async ([title], index) => {
        const dbRef = db.ref('ai-jobs').child(payload.jobId).child("progress").child(payload.lessonIndex).child(payload.lessonName.replace(/\./g, "")).child(index + '').child(title.replace(/\./g, ""))
        await dbRef.update({
          retryCount: retries + 1,
          status: "RETRYING",
          error: error.message,
        })
      }))
      await delay(3000)
      await makeAICall(prompt, retries + 1, sections, callback)
    } else {
      await Promise.all(sections.map(async ([title], index) => {
        const dbRef = db.ref('ai-jobs').child(payload.jobId).child("progress").child(payload.lessonIndex).child(payload.lessonName.replace(/\./g, "")).child(index + '').child(title.replace(/\./g, ""))
        await dbRef.update({
          status: "FAILED",
          error: error.message,
          end: new Date().toISOString(),
        })
      }))
    }
  }

  const makeAICall = async function (prompt: string, retries: number, sections: [string, string][], callback: (data: any) => Promise<void>) {
    try {
      const thread = await openai.beta.threads.create({
        messages: [{ role: "user", content: prompt }],
      })

      const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: payload.assistantId,
      })
      await delay(2000)
      const messages = await openai.beta.threads.messages.list(thread.id, { run_id: run.id })
      const message = messages.data.pop()

      if (message?.content?.[0]?.type === "text") {
        const { text } = message.content[0]
        const data = JSON.parse(text.value.replace("```json", '').replace("```", ''))
        await callback(data)
      } else {
        throw new Error("retry")
      }
    } catch (error) {
      console.log(retries)
      await handleRetry(prompt, retries, sections, callback, error as Error)
    }
  }

  const sectionPrompt = generateSectionsFilePrompt(payload.title, payload.lessonName, payload.sections)

  try {
    await makeAICall(sectionPrompt, 0, payload.sections.map(({ seedTitle, seedContent }) => [seedTitle, seedContent]), async (sections: { [name: string]: SectionResultAI }) => {
      const lists = Object.values(sections)
      let sectionIndex = 0
      for (let section of lists) {
        const dbRef = db.ref('ai-jobs').child(payload.jobId).child("progress").child(payload.lessonIndex).child(payload.lessonName.replace(/\./g, "")).child(sectionIndex + '').child(section.sectionName.replace(/\./g, ""))
        let followupQuiz: QuizAI[] = []
        let quiz: QuizAI[] = []
        let flqId = "", qId = ""
        try {

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
          let answer = section.followupQuiz.correct_answer
          let index = section.followupQuiz.options.findIndex((e) => e.toLowerCase() === answer.toLowerCase())
          const q = await courseService.addBlockQuiz({
            question: section.followupQuiz.question,
            choices: section.followupQuiz.options.map(e => e.toLowerCase()),
            correctAnswerContext: `${section.followupQuiz.explanation}`,
            correctAnswerIndex: isNaN(Number(index)) ? 0 : Number(index),
            revisitChunk: "",
            wrongAnswerContext: `${section.followupQuiz.explanation}`
          }, payload.lessonId, payload.courseId, block.id)
          flqId = q.id

          const dp = await courseService.addLessonQuiz({
            question: section.sectionQuiz.question,
            choices: section.sectionQuiz.options,
            correctAnswerContext: `${section.sectionQuiz.explanation}`,
            correctAnswerIndex: isNaN(Number(section.sectionQuiz.correct_answer)) ? 0 : Number(section.sectionQuiz.correct_answer),
            hint: section.sectionQuiz.hint,
            block: block.id,
            revisitChunk: section.sectionQuiz.explanation,
            wrongAnswerContext: `${section.sectionQuiz.explanation}`
          }, payload.lessonId, payload.courseId)
          qId = dp.id

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
          sectionIndex++
        } catch (error) {
          console.log(error)
          await dbRef
            .update({
              status: "FAILED",
              error: (error as any).message,
              end: new Date().toISOString()
            })
        }
      }
    })
  } catch (error) {
    console.log(error)
    await db.ref('ai-jobs').child(payload.jobId)
      .update({
        status: "FAILED",
        error: (error as any).message,
        end: new Date().toISOString()
      })
  }
}

export const buildSectionFromFile = async function (payload: BuildSectionFromFilePayload) {
  const dbRef = db.ref('ai-jobs').child(payload.jobId).child("progress").child(payload.lessonName.replace(/\./g, "")).child(payload.seedTitle.replace(/\./g, ""))

  const handleRetry = async function (prompt: string, retries: number, callback: (data: any) => Promise<void>, error: Error) {
    const maxRetries = 5
    if (retries <= maxRetries) {
      await dbRef.update({
        retryCount: retries + 1,
        status: "RETRYING",
        error: error.message,
      })
      await delay(3000)
      await makeAICall(prompt, retries + 1, callback)
    } else {
      await dbRef.update({
        status: "FAILED",
        error: error.message,
        end: new Date().toISOString(),
      })
    }
  }

  const makeAICall = async function (prompt: string, retries: number, callback: (data: any) => Promise<void>) {
    try {
      const thread = await openai.beta.threads.create({
        messages: [{ role: "user", content: prompt }],
      })

      const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: payload.assistantId,
      })
      await delay(2000)
      const messages = await openai.beta.threads.messages.list(thread.id, { run_id: run.id })
      const message = messages.data.pop()

      if (message?.content?.[0]?.type === "text") {
        const { text } = message.content[0]
        const data = JSON.parse(text.value.replace("```json", '').replace("```", ''))
        await callback(data)
      } else {
        throw new Error("retry")
      }
    } catch (error) {
      console.log(retries)
      await handleRetry(prompt, retries, callback, error as Error)
    }
  }

  const sectionPrompt = generateSectionFilePrompt(payload.title, payload.lessonName, payload.seedTitle, payload.seedContent)

  try {
    await makeAICall(sectionPrompt, 0, async (section: SectionResultAI) => {
      let followupQuiz: QuizAI[] = []
      let quiz: QuizAI[] = []
      let flqId = "", qId = ""
      try {

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
        let answer = section.followupQuiz.correct_answer
        let index = section.followupQuiz.options.findIndex((e) => e.toLowerCase() === answer.toLowerCase())
        const q = await courseService.addBlockQuiz({
          question: section.followupQuiz.question,
          choices: section.followupQuiz.options.map(e => e.toLowerCase()),
          correctAnswerContext: `${section.followupQuiz.explanation}`,
          correctAnswerIndex: isNaN(Number(index)) ? 0 : Number(index),
          revisitChunk: "",
          wrongAnswerContext: `${section.followupQuiz.explanation}`
        }, payload.lessonId, payload.courseId, block.id)
        flqId = q.id

        const dp = await courseService.addLessonQuiz({
          question: section.sectionQuiz.question,
          choices: section.sectionQuiz.options,
          correctAnswerContext: `${section.sectionQuiz.explanation}`,
          correctAnswerIndex: isNaN(Number(section.sectionQuiz.correct_answer)) ? 0 : Number(section.sectionQuiz.correct_answer),
          hint: section.sectionQuiz.hint,
          block: block.id,
          revisitChunk: section.sectionQuiz.explanation,
          wrongAnswerContext: `${section.sectionQuiz.explanation}`
        }, payload.lessonId, payload.courseId)
        qId = dp.id

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
        await dbRef
          .update({
            status: "FAILED",
            error: (error as any).message,
            end: new Date().toISOString()
          })
      }
    })
  } catch (error) {
    console.log(error)
    await db.ref('ai-jobs').child(payload.jobId)
      .update({
        status: "FAILED",
        error: (error as any).message,
        end: new Date().toISOString()
      })
  }
}


export const initiateDocumentQueryAssistant = async function ({ jobId, prompt, title, files: filePaths, teamId }: { jobId: string, prompt: string, title: string, files: string[], teamId: string }) {
  const assistant = await openai.beta.assistants.create({
    name: "Course creator assistant",
    instructions: "You are an expert creating byte sized course contents. Use you knowledge base to answer questions about the course conflict resolution.",
    model: "gpt-3.5-turbo",
    tools: [{ type: "file_search" }],
  })

  const dbRef = db.ref("ai-jobs").child(jobId)
  await dbRef
    .set({
      status: "RUNNING",
      stage: "OUTLINE",
      title,
      lessonCount: 0,
      result: null,
      error: null
    })

  const fileStreams = filePaths.map((path) => fs.createReadStream(path))

  // Create a vector store
  const vectorStore = await openai.beta.vectorStores.create({
    name: "Course content: " + title,
  })

  try {
    // Upload files to the vector store
    const uploadPromises = fileStreams.map(async (stream) => {
      const file = await openai.files.create({
        file: stream,
        purpose: "fine-tune",
      })
      return file
    })
    // Wait for all uploads to complete
    const files = await Promise.all(uploadPromises)
    await Promise.all([openai.beta.vectorStores.fileBatches.createAndPoll(vectorStore.id, {
      file_ids: files.map(e => e.id)
    }), openai.beta.assistants.update(assistant.id, {
      tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
    })])

    const handleRetry = async function (prompt: string, retries: number, callback: (data: any) => Promise<void>, error: Error) {
      const maxRetries = 5
      if (retries < maxRetries) {
        await dbRef.update({
          retryCount: retries + 1,
          status: "RETRYING",
          error: error.message,
        })
        await makeAICall(prompt, retries + 1, callback)
      } else {
        await dbRef.update({
          status: "FAILED",
          error: error.message,
          end: new Date().toISOString(),
        })
      }
    }

    const makeAICall = async function (prompt: string, retries: number, callback: (data: any) => Promise<void>) {
      try {
        const thread = await openai.beta.threads.create({
          messages: [
            {
              role: "user",
              content: prompt
            },
          ],
        })

        const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
          assistant_id: assistant.id,
        })

        const messages = await openai.beta.threads.messages.list(thread.id, {
          run_id: run.id,
        })

        const message = messages.data.pop()!


        if (message && message.content && message.content[0] && message.content[0].type === "text") {
          const { text } = message.content[0]
          let data = JSON.parse(text.value.replace("```json", '').replace("```", ""))
          callback(data)
        } else {
          throw new Error("retry")
        }
      } catch (error) {
        await handleRetry(prompt, retries + 1, callback, error as Error)
      }
    }


    makeAICall(prompt, 0, async ({ description, lessons }: Curriculum) => {

      const course = await courseService.createCourse({
        title,
        headerMedia: {
          mediaType: MediaType.IMAGE,
          url: "https://picsum.photos/200/300.jpg",
          awsFileKey: ""
        },
        contents: [],
        source: Sources.AI,
        bundle: false,
        private: false,
        free: true,
        description
      }, teamId)

      const updateHeaderImage = async function () {
        try {
          const team = await Teams.findById(teamId)
          if (team) {
            const headerMedia = await generateCourseHeaderImage(course, team)
            await courseService.updateCourse({
              headerMedia: {
                url: headerMedia,
                mediaType: MediaType.IMAGE
              }
            }, course.id, teamId)
          }
        } catch (error) {
          console.log("failed to generate header")
        }
      }

      updateHeaderImage()

      await dbRef
        .update({
          status: "RUNNING",
          stage: "BUILDER",
          courseId: course.id,
          lessonCount: Object.values(lessons).length
        })
      let lists = Object.values(lessons)
      const progressRef = dbRef.child("progress")
      let index = 0
      for (let lesson of lists) {
        let sections = Object.values(lesson.sections)
        let sectionIndex = 0
        for (let section of sections) {
          await progressRef.child(index + '').child(lesson.lesson_name.replace(/\./g, "")).child(sectionIndex + '').child(section[0].replace(/\./g, "")).set({ status: "RUNNING", courseId: course.id })
          sectionIndex++
        }
        index++
      }
      let lessonIndex = 0
      for (let lesson of lists) {
        console.log("lesson starts", lesson.lesson_name)
        const lessonDetail = await courseService.createLesson({
          title: lesson.lesson_name
        }, course.id)
        let sections = Object.values(lesson.sections)
        let total = sections.length
        let curr = 1
        if (total > 0) {
          await buildSectionsFromFile({
            assistantId: assistant.id,
            sections: sections.map((val) => ({
              seedTitle: val[0],
              seedContent: val[1]
            })),
            lessonIndex: lessonIndex + '',
            lessonId: lessonDetail.id,
            lessonName: lesson.lesson_name,
            jobId,
            title,
            courseId: course.id,
            last: curr === total,
            storeId: vectorStore.id
          })
        }
        console.log("lesson done", lesson.lesson_name)
        lessonIndex++
      }
      await dbRef
        .update({
          status: "FINISHED",
          stage: "BUILDER",
          courseId: course.id,
          lessonCount: Object.values(lessons).length
        })
      // 


      await Promise.all([...files.map(e => openai.files.del(e.id)), openai.beta.vectorStores.del(vectorStore.id)])
    })
  } catch (error) {
    console.log(error)
  }

}




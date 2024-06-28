import Agenda, { Job, Processor } from "agenda"
import AppConfig from '../../../config/config'
import { GENERATE_COURSE_OUTLINE_AI, GENERATE_COURSE_OUTLINE_FILE, GENERATE_SECTION_AI, GENERATE_SECTION_FILE } from '../MessageTypes'
import { buildCourseOutline, buildSection, buildSectionFromFile, initiateDocumentQueryAssistant } from '../../ai/services'
import { BuildSectionFromFilePayload, BuildSectionPayload } from '../../ai/interfaces'


export const handleCourseOutlineAI: Processor<{ courseId: string, prompt: string, title: string, lessonCount: number }> = async (job: Job<{ courseId: string, prompt: string, title: string, lessonCount: number }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      buildCourseOutline(data)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}


export const handleCourseOutlineFile: Processor<{ jobId: string, prompt: string, title: string, files: string[], teamId: string }> = async (job: Job<{ jobId: string, prompt: string, title: string, files: string[], teamId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      initiateDocumentQueryAssistant(data)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

export const handleSectionAI: Processor<BuildSectionPayload> = async (job: Job<BuildSectionPayload>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      buildSection(data)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

export const handleSectionFile: Processor<BuildSectionFromFilePayload> = async (job: Job<BuildSectionFromFilePayload>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      buildSectionFromFile(data)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

module.exports = (agenda: Agenda) => {
  agenda.define<{ jobId: string, prompt: string, title: string, files: string[], teamId: string }>(GENERATE_COURSE_OUTLINE_FILE, handleCourseOutlineFile)
  agenda.define<BuildSectionFromFilePayload>(GENERATE_SECTION_FILE, handleSectionFile)


  agenda.define<{ courseId: string, prompt: string, title: string, lessonCount: number }>(GENERATE_COURSE_OUTLINE_AI, handleCourseOutlineAI)
  agenda.define<BuildSectionPayload>(GENERATE_SECTION_AI, handleSectionAI)
}
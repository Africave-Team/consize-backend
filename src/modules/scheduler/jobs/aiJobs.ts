import Agenda, { Job, Processor } from "agenda"
import AppConfig from '../../../config/config'
import { GENERATE_COURSE_OUTLINE_AI, GENERATE_SECTION_AI } from '../MessageTypes'
import { buildCourseOutline, buildSection } from '../../ai/services'
import { BuildSectionPayload } from '@/modules/ai/interfaces'


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

module.exports = (agenda: Agenda) => {
  agenda.define<{ courseId: string, prompt: string, title: string, lessonCount: number }>(GENERATE_COURSE_OUTLINE_AI, handleCourseOutlineAI)
  agenda.define<BuildSectionPayload>(GENERATE_SECTION_AI, handleSectionAI)
}
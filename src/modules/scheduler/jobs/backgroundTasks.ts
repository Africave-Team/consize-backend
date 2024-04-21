import Agenda, { Job, Processor } from "agenda"
import AppConfig from '../../../config/config'
import { GENERATE_COURSE_TRENDS } from '../MessageTypes'
import { generateCurrentCourseTrends } from '@/modules/courses/service.courses'

const handleCourseTrends: Processor<{ courseId: string, teamId: string }> = async (job: Job<{ courseId: string, teamId: string }>) => {
  try {
    if (AppConfig.env !== "test") {
      const data = job.attrs.data
      const { courseId, teamId } = data
      generateCurrentCourseTrends(courseId, teamId)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

module.exports = (agenda: Agenda) => {
  agenda.define<{ courseId: string, teamId: string }>(GENERATE_COURSE_TRENDS, handleCourseTrends)
}
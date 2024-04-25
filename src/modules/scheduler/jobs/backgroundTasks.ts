import Agenda, { Job, Processor } from "agenda"
import AppConfig from '../../../config/config'
import { GENERATE_COURSE_TRENDS, RESUME_TOMORROW } from '../MessageTypes'
import { generateCurrentCourseTrends } from '../../courses/service.courses'
import { CourseEnrollment } from '@/modules/webhooks/interfaces.webhooks'
import config from '../../../config/config'
import { sendResumptionMessage } from '../../webhooks/service.webhooks'

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

const handleContinueTomorrow: Processor<{ enrollment: CourseEnrollment, phoneNumber: string, messageId: string }> = async (job: Job<{ enrollment: CourseEnrollment, phoneNumber: string, messageId: string }>) => {
  try {
    if (AppConfig.env === "local") {
      const data = job.attrs.data
      const { enrollment, phoneNumber } = data
      await sendResumptionMessage(phoneNumber, `${config.redisBaseKey}enrollments:${phoneNumber}:${enrollment.id}`, enrollment)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

module.exports = (agenda: Agenda) => {
  agenda.define<{ courseId: string, teamId: string }>(GENERATE_COURSE_TRENDS, handleCourseTrends)
  agenda.define<{ enrollment: CourseEnrollment, phoneNumber: string, messageId: string }>(RESUME_TOMORROW, handleContinueTomorrow)
}
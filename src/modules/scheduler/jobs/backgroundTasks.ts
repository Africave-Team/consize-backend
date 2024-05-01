import Agenda, { Job, Processor } from "agenda"
import AppConfig from '../../../config/config'
import { COHORT_SCHEDULE, COHORT_SCHEDULE_STUDENT, DAILY_REMINDER, DAILY_ROUTINE, GENERATE_COURSE_TRENDS, RESUME_TOMORROW } from '../MessageTypes'
import { generateCurrentCourseTrends } from '../../courses/service.courses'
import { CourseEnrollment } from '../../webhooks/interfaces.webhooks'
import config from '../../../config/config'
import { sendResumptionMessage } from '../../webhooks/service.webhooks'
import Reminders from '../reminders.model'
// import { agenda } from '..'
import { Course } from '../../courses'
import { CourseSettings } from '../../courses/interfaces.settings'
import Settings from '../../courses/model.settings'
import { initiateCourseForCohort, initiateCourseForCohortForSingleStudent } from '../../cohorts/service.cohorts'

export const handleCourseTrends: Processor<{ courseId: string, teamId: string }> = async (job: Job<{ courseId: string, teamId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
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
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      const { enrollment, phoneNumber } = data
      await sendResumptionMessage(phoneNumber, `${config.redisBaseKey}enrollments:${phoneNumber}:${enrollment.id}`, enrollment)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleStartDailyRoutine: Processor<{ courseId: string, studentId: string }> = async (job: Job<{ courseId: string, studentId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      let reminder = await Reminders.findOne({ course: data.courseId, student: data.studentId })
      if (!reminder) {
        reminder = await Reminders.create({
          course: data.courseId, student: data.studentId, dailyCount: 0, lastActivity: new Date()
        })
      }

      if (reminder.dailyCount === 0) {
        // get the course settings
        const course = await Course.findById(data.courseId).select("settings")
        if (course && course.settings) {
          let settings: CourseSettings | null = await Settings.findById(course.settings)
          if (settings) {
            let time = settings.reminderSchedule[0]
            if (time) {
              // agenda.schedule()

            }

          }
        }
      }
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleDailyReminders: Processor<{ courseId: string, studentId: string }> = async (job: Job<{ courseId: string, studentId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      console.log(data)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleCohortSchedule: Processor<{ cohortId: string }> = async (job: Job<{ cohortId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      initiateCourseForCohort(data.cohortId)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleCohortScheduleStudent: Processor<{ cohortId: string, studentId: string }> = async (job: Job<{ cohortId: string, studentId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      initiateCourseForCohortForSingleStudent(data.cohortId, data.studentId)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

module.exports = (agenda: Agenda) => {
  agenda.define<{ courseId: string, teamId: string }>(GENERATE_COURSE_TRENDS, handleCourseTrends)
  agenda.define<{ courseId: string, studentId: string }>(DAILY_ROUTINE, handleStartDailyRoutine)
  agenda.define<{ courseId: string, studentId: string }>(DAILY_REMINDER, handleDailyReminders)
  agenda.define<{ cohortId: string }>(COHORT_SCHEDULE, handleCohortSchedule)
  agenda.define<{ cohortId: string, studentId: string }>(COHORT_SCHEDULE_STUDENT, handleCohortScheduleStudent)
  agenda.define<{ enrollment: CourseEnrollment, phoneNumber: string, messageId: string }>(RESUME_TOMORROW, handleContinueTomorrow)
}
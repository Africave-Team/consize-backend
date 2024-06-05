import Agenda, { Job, Processor } from "agenda"
import AppConfig from '../../../config/config'
import { COHORT_SCHEDULE, COHORT_SCHEDULE_STUDENT, DAILY_REMINDER, DAILY_ROUTINE, ENROLL_STUDENT_DEFAULT_DATE, GENERATE_COURSE_TRENDS, HANDLE_SUBSCRIPTION_GRACE_PERIOD_TERMINATION, HANDLE_SUBSCRIPTION_TERMINATION, INACTIVITY_REMINDER, INACTIVITY_REMINDER_SHORT, REMIND_ME, RESUME_TOMORROW } from '../MessageTypes'
import { generateCurrentCourseTrends, handleStudentSlack, handleStudentWhatsapp, initiateDailyRoutine } from '../../courses/service.courses'
import { CourseEnrollment, DailyReminderNotificationPayload } from '../../webhooks/interfaces.webhooks'
import config from '../../../config/config'
import { handleRemindMeTrigger, sendInactivityMessage, sendResumptionMessage, sendShortInactivityMessage } from '../../webhooks/service.webhooks'
import { initiateCourseForCohort, initiateCourseForCohortForSingleStudent } from '../../cohorts/service.cohorts'
import { sendResumptionMessageSlack } from '../../slack/slack.services'
import { Distribution } from '../../courses/interfaces.courses'
import { handleTerminateSubscription, handleTerminateSubscriptionGracePeriod } from '../../subscriptions/subscriptions.services'
import { studentService } from '@/modules/students'

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

const handleContinueTomorrow: Processor<{ enrollment: CourseEnrollment, phoneNumber?: string, messageId: string, channelId?: string }> = async (job: Job<{ enrollment: CourseEnrollment, phoneNumber?: string, channelId?: string, messageId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      const { enrollment, phoneNumber, channelId } = data
      if (phoneNumber && !channelId) {
        await sendResumptionMessage(phoneNumber, `${config.redisBaseKey}enrollments:${phoneNumber}:${enrollment.id}`, enrollment)
      }
      if (channelId && !phoneNumber) {
        sendResumptionMessageSlack(channelId, `${config.redisBaseKey}enrollments:slack:${channelId}:${enrollment.id}`, enrollment)
      }
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleStartDailyRoutine: Processor<any> = async () => {
  try {
    if (AppConfig.server !== "test") {
      initiateDailyRoutine()
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleDailyReminders: Processor<DailyReminderNotificationPayload> = async (job: Job<DailyReminderNotificationPayload>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      if (data.distribution === Distribution.SLACK) {
        handleStudentSlack(data)
      } else {
        handleStudentWhatsapp(data)
      }
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

const handleInactivityReminders: Processor<{ studentId: string, courseId: string, slackToken: string, slackChannel?: string, phoneNumber?: string }> = async (job: Job<{ studentId: string, courseId: string, slackToken: string, slackChannel?: string, phoneNumber?: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      await sendInactivityMessage(data)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleShortInactivityReminders: Processor<{ studentId: string, courseId: string, slackToken: string, slackChannel?: string, phoneNumber?: string }> = async (job: Job<{ studentId: string, courseId: string, slackToken: string, slackChannel?: string, phoneNumber?: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      await sendShortInactivityMessage(data)
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

const handleRemindMe: Processor<{}> = async () => {
  try {
    if (AppConfig.server !== "test") {
      await handleRemindMeTrigger()
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleSubTermination: Processor<{ subscriptionId: string }> = async (job: Job<{ subscriptionId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      handleTerminateSubscription(job.attrs.data.subscriptionId)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleSubGracePeriodTermination: Processor<{ subscriptionId: string }> = async (job: Job<{ subscriptionId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      handleTerminateSubscriptionGracePeriod(job.attrs.data.subscriptionId)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleStudentEnrollment: Processor<{ studentId: string, courseId: string }> = async (job: Job<{ studentId: string, courseId: string }>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      studentService.startEnrollmentWhatsapp(data.studentId, data.courseId)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

module.exports = (agenda: Agenda) => {
  agenda.define<{ courseId: string, teamId: string }>(GENERATE_COURSE_TRENDS, handleCourseTrends)
  agenda.define<any>(DAILY_ROUTINE, handleStartDailyRoutine)
  agenda.define<DailyReminderNotificationPayload>(DAILY_REMINDER, handleDailyReminders)
  agenda.define<{ cohortId: string }>(COHORT_SCHEDULE, handleCohortSchedule)
  agenda.define(REMIND_ME, handleRemindMe)
  agenda.define<{ cohortId: string, studentId: string }>(COHORT_SCHEDULE_STUDENT, handleCohortScheduleStudent)
  agenda.define<{ studentId: string, courseId: string, slackToken: string, slackChannel?: string, phoneNumber?: string }>(INACTIVITY_REMINDER, handleInactivityReminders)
  agenda.define<{ studentId: string, courseId: string, slackToken: string, slackChannel?: string, phoneNumber?: string }>(INACTIVITY_REMINDER_SHORT, handleShortInactivityReminders)
  agenda.define<{ enrollment: CourseEnrollment, phoneNumber?: string, messageId: string, channelId?: string }>(RESUME_TOMORROW, handleContinueTomorrow)

  // subscriptions
  agenda.define<{ subscriptionId: string }>(HANDLE_SUBSCRIPTION_TERMINATION, handleSubTermination)
  agenda.define<{ subscriptionId: string }>(HANDLE_SUBSCRIPTION_GRACE_PERIOD_TERMINATION, handleSubGracePeriodTermination)

  agenda.define<{ studentId: string, courseId: string }>(ENROLL_STUDENT_DEFAULT_DATE, handleStudentEnrollment)
}
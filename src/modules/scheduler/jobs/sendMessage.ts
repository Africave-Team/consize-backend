import Agenda, { Job, Processor } from "agenda"
import AppConfig from '../../../config/config'
import { SEND_VERIFICATION_EMAIL, SEND_FORGOT_PASSWORD_EMAIL, SEND_TEAM_INVITATION, SEND_WHATSAPP_MESSAGE, SEND_LEADERBOARD, SEND_CERTIFICATE, SEND_SLACK_MESSAGE, SEND_SLACK_RESPONSE, SEND_LEADERBOARD_SLACK, SEND_CERTIFICATE_SLACK, SEND_SLACK_MODAL } from '../MessageTypes'
import { emailService } from '../../../modules/email'
import { sendMessage } from '../../../modules/webhooks/service.webhooks'
import { CourseEnrollment, Message } from '../../../modules/webhooks/interfaces.webhooks'
import { sendCourseCertificate, sendCourseCertificateSlack, sendCourseLeaderboard, sendCourseLeaderboardSlack } from '../../../modules/generators/generator.service'
import { SendSlackMessagePayload, SendSlackModalPayload, SendSlackResponsePayload } from '../../slack/interfaces.slack'
import { sendSlackMessage, sendSlackModalMessage, sendSlackResponseMessage } from '../../slack/slack.services'
import { AxiosError } from 'axios'

export interface SEND_VERIFICATION_MESSAGE {
  email: string
  name: string
  code: string
  teamName?: string
}

const forgotPasswordprocessor: Processor<SEND_VERIFICATION_MESSAGE> = async (job: Job<SEND_VERIFICATION_MESSAGE>) => {
  const { code, email, name, } = job.attrs.data
  try {
    if (AppConfig.server !== "test") {
      await emailService.sendResetPasswordEmail(email, code, name.split(' ')[0] || 'Customer')
    }
  } catch (error) {
    console.log(error)
  }
}

const verifyEmailProcessor: Processor<SEND_VERIFICATION_MESSAGE> = async (job: Job<SEND_VERIFICATION_MESSAGE>) => {
  const { code, email, name, } = job.attrs.data
  try {
    if (AppConfig.server !== "test") {
      await emailService.sendVerificationEmail(email, name.split(' ')[0] || 'User', code)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleTeamInviteEmail: Processor<SEND_VERIFICATION_MESSAGE> = async (job: Job<SEND_VERIFICATION_MESSAGE>) => {
  const { code, email, name, teamName } = job.attrs.data
  try {
    if (AppConfig.server !== "test") {
      await emailService.sendTeamInvitationEmail(email, name.split(' ')[0] || 'User', teamName || 'Consize', code)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleSendWhatsappMessage: Processor<Message> = async (job: Job<Message>) => {
  try {
    if (AppConfig.server !== "test") {
      await sendMessage(job.attrs.data)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleSendSlackMessage: Processor<SendSlackMessagePayload> = async (job: Job<SendSlackMessagePayload>) => {
  try {
    if (AppConfig.server !== "test") {
      const { message, channel, accessToken } = job.attrs.data
      await sendSlackMessage(accessToken, channel, message)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleSendSlackResponseMessage: Processor<SendSlackResponsePayload> = async (job: Job<SendSlackResponsePayload>) => {
  try {
    if (AppConfig.server !== "test") {
      const { message, url } = job.attrs.data
      await sendSlackResponseMessage(url, message)
    }
  } catch (error) {
    console.log(((error as AxiosError).response?.config.data), "error send message")
  }
}



const handleSendSlackModalMessage: Processor<SendSlackModalPayload> = async (job: Job<SendSlackModalPayload>) => {
  try {
    if (AppConfig.server !== "test") {
      const { view, token, trigger_id } = job.attrs.data
      await sendSlackModalMessage(token, trigger_id, view)
    }
  } catch (error) {
    console.log(((error as AxiosError).response?.config.data), "error send message")
  }
}

const handleSendLeaderboard: Processor<CourseEnrollment> = async (job: Job<CourseEnrollment>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      const { id, student } = data
      sendCourseLeaderboard(id, student, data)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleSendCertificate: Processor<CourseEnrollment> = async (job: Job<CourseEnrollment>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      const { id, student } = data
      sendCourseCertificate(id, student)
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}


const handleSendLeaderboardSlack: Processor<CourseEnrollment> = async (job: Job<CourseEnrollment>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      const { id, student, slackResponseUrl } = data
      if (slackResponseUrl) {
        sendCourseLeaderboardSlack(id, student, data, slackResponseUrl)
      }
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

const handleSendCertificateSlack: Processor<CourseEnrollment> = async (job: Job<CourseEnrollment>) => {
  try {
    if (AppConfig.server !== "test") {
      const data = job.attrs.data
      const { id, student, slackResponseUrl } = data
      if (slackResponseUrl) {
        sendCourseCertificateSlack(id, student)
      }
    }
  } catch (error) {
    console.log(error, "error send message")
  }
}

module.exports = (agenda: Agenda) => {
  agenda.define<SEND_VERIFICATION_MESSAGE>(SEND_VERIFICATION_EMAIL, verifyEmailProcessor)
  agenda.define<SEND_VERIFICATION_MESSAGE>(SEND_TEAM_INVITATION, handleTeamInviteEmail)


  agenda.define<SEND_VERIFICATION_MESSAGE>(SEND_FORGOT_PASSWORD_EMAIL, forgotPasswordprocessor)
  agenda.define<Message>(SEND_WHATSAPP_MESSAGE, handleSendWhatsappMessage)
  agenda.define<CourseEnrollment>(SEND_LEADERBOARD, handleSendLeaderboard)
  agenda.define<CourseEnrollment>(SEND_CERTIFICATE, handleSendCertificate)

  agenda.define<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, handleSendSlackMessage)
  agenda.define<SendSlackModalPayload>(SEND_SLACK_MODAL, handleSendSlackModalMessage)
  agenda.define<SendSlackResponsePayload>(SEND_SLACK_RESPONSE, handleSendSlackResponseMessage)


  agenda.define<CourseEnrollment>(SEND_LEADERBOARD_SLACK, handleSendLeaderboardSlack)
  agenda.define<CourseEnrollment>(SEND_CERTIFICATE_SLACK, handleSendCertificateSlack)
}
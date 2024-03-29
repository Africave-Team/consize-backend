import Mailjet from 'node-mailjet'
import config from '../../config/config'
import logger from '../logger/logger'
import { Message } from './email.interfaces'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'


const mailjet = Mailjet.apiConnect(
  config.email.smtp.auth.user,
  config.email.smtp.auth.pass,
  {
    config: {},
    options: {}
  }
)
/* istanbul ignore next */
// if (config.env !== 'test') {
//   transport
//     .verify()
//     .then(() => logger.info('Connected to email server'))
//     .catch(() => logger.warn('Unable to connect to email server. Make sure you have configured the SMTP options in .env'))
// }


export async function getTemplate (
  template: string,
  data: any
): Promise<string> {
  let path = join(__dirname, 'templates/' + template + '.hbs')
  let fileExists = existsSync(path)
  let content = ''
  if (fileExists) {
    let contents = readFileSync(path, 'utf-8')
    for (var i in data) {
      var x = '{{' + i + '}}'
      while (contents.indexOf(x) > -1) {
        // @ts-ignore
        contents = contents.replace(x, data[i])
      }
    }
    content = contents
  }
  return content
}

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @returns {Promise<void>}
 */
export const sendEmail = async ({ to, template, templateVariables, subject }: Message): Promise<void> => {
  try {
    const contents = await getTemplate(template, templateVariables)
    const info = await mailjet.post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: config.email.from,
              Name: "Pat from Consize"
            },
            To: [
              {
                Email: to,
              }
            ],
            HTMLPart: contents,
            Subject: subject
          }
        ]
      })
    logger.info(info)
  } catch (error) {
    logger.error(error)
  }
}

export const sendResetPasswordEmail = async (to: string, token: string, firstName: string): Promise<void> => {
  await sendEmail({ to, templateVariables: { firstName, url: `${config.clientUrl}/auth/reset-password?token=${token}` }, template: "forgot", subject: "You forgot your password" })
}

export const sendVerificationEmail = async (to: string, firstName: string, token: string): Promise<void> => {
  // 5812715
  await sendEmail({ to, templateVariables: { firstName, url: `${config.clientUrl}/auth/verify?token=${token}` }, template: "verify", subject: "Let's verify your email" })
}


export const sendTeamInvitationEmail = async (to: string, firstName: string, teamName: string, token: string): Promise<void> => {
  await sendEmail({ to, templateVariables: { firstName, url: `${config.clientUrl}/auth/team-invitation?token=${token}` }, template: "invite", subject: "You have been invited to " + teamName })
}

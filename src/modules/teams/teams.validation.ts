import Joi from 'joi'
import { NewTeamUser } from './interfaces.teams'

const inviteMemberBody: Record<keyof NewTeamUser, any> = {
  email: Joi.string().required().email(),
  name: Joi.string().required(),
  permissionGroup: Joi.string().required()
}

export const inviteUser = {
  body: Joi.object().keys(inviteMemberBody),
}

export const resendInvite = {
  body: Joi.object().keys({
    userId: Joi.string().required()
  }),
}

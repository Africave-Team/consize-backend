import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { teamControllers } from "../../modules/teams"
import { inviteUser, resendInvite } from '../../modules/teams/teams.validation'

const router: Router = express.Router()
router.patch('/invite', teamControllers.acceptTeamInvite)
router.use(auth())
router.get('/', teamControllers.fetchTeamMembers)
router.post('/invite', validate(inviteUser), auth(), teamControllers.inviteTeamMembers)
router.post('/resend-invite', validate(resendInvite), auth(), teamControllers.resendInvite)
router.delete('/invite/:userId', auth(), teamControllers.removeTeamMember)

export default router

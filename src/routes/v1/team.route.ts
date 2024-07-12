import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { teamControllers } from "../../modules/teams"
import { inviteUser, resendInvite } from '../../modules/teams/teams.validation'

const router: Router = express.Router()
router.patch('/invite', teamControllers.acceptTeamInvite)
router.get('/resolve/:code', teamControllers.resolveTeamInfo)
router.use(auth())
router.get('/', teamControllers.fetchTeamMembers)
router.put('/:teamId', teamControllers.updateTeamInfo)
router.get('/:teamId', teamControllers.fetchTeamInfo)
router.post('/invite', validate(inviteUser), teamControllers.inviteTeamMembers)
router.post('/resend-invite', validate(resendInvite), teamControllers.resendInvite)
router.delete('/invite/:userId', teamControllers.removeTeamMember)


export default router

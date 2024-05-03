import express, { Router } from 'express'
import { auth } from '../../../modules/admin'

const router: Router = express.Router()
router.use(auth())
// router.get('/', teamControllers.fetchTeamMembers)
export default router

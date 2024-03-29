import express, { Router } from 'express'
// import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { pgController } from "../../modules/permission-groups"

const router: Router = express.Router()
router.get('/groups', auth(), pgController.fetchAllPgs)
router.get('/', auth(), pgController.fetchAllPermissions)
export default router

import express, { Router } from 'express'
// import { validate } from '../../modules/validate'
// import { auth } from '../../modules/auth'
import { studentController } from "../../modules/students"

const router: Router = express.Router()
// router.use(auth())
router.post('/bulk-save', studentController.bulkAddStudents)
export default router

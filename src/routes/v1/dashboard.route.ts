import express, { Router } from "express"
// import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { dashboardController } from "../../modules/dashboard/"


const router: Router = express.Router()
router.use(auth())

// router.get('/courses',  dashboardController.courseMetrics)
router.get('/learners', dashboardController.learnersMetrics)
// router.get('/assessment', dashboardController.assessmentMetrics)

export default router
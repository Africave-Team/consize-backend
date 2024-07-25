import express, { Router } from "express"
// import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { dashboardController } from "../../modules/dashboard/"


const router: Router = express.Router()
router.use(auth())

router.get('/courses',  dashboardController.courseMetrics)
router.get('/learners', dashboardController.learnersMetrics)
router.get('/assessment', dashboardController.assessmentMetrics)
router.get('/graph-metrics', dashboardController.graphMetrics)
router.get('/top-courses', dashboardController.topCourseMetrics)
router.get('/top-level-metrics', dashboardController.topLevelMetrics)

export default router
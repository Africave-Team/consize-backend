import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { courseControllers, courseValidators } from "../../modules/courses"

const router: Router = express.Router()
router.use(auth())
router.get('/', courseControllers.fetchTeamCourses)
router.get('/search', courseControllers.searchTeamCourses)
router.post('/', validate(courseValidators.createCourse), courseControllers.createCourseManually)
router.put('/:course', validate(courseValidators.updateCourse), courseControllers.updateCourse)
router.get('/:course', courseControllers.fetchTeamSingleCourse)

export default router

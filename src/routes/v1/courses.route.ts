import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { courseControllers, courseValidators } from "../../modules/courses"

const router: Router = express.Router()
router.route('/public/all').get(courseControllers.fetchPublishedCourses)
router.route('/public/single/:course').get(courseControllers.fetchSingleCourse)
router.use(auth())
router.get('/', courseControllers.fetchTeamCourses)
router.get('/search', courseControllers.searchTeamCourses)
router.post('/', validate(courseValidators.createCourse), courseControllers.createCourseManually)
router.route('/:course')
  .get(courseControllers.fetchTeamSingleCourse)
  .put(validate(courseValidators.updateCourse), courseControllers.updateCourse)
router.put('/settings/:id', courseControllers.updateCourseSetting)
router.post('/settings/add-learner-group/:id', courseControllers.addLearnerGroup)
router.delete('/settings/remove-learner-group/:id/:groupId', courseControllers.removeLearnerGroup)

router.patch('/settings/launchtimes/:id/:groupId', courseControllers.setLearnerGroupLaunchTime)

export default router

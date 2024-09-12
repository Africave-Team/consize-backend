import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import downloadMiddleware from '../../modules/courses/middlewares'
import { courseControllers, courseValidators } from "../../modules/courses"

const router: Router = express.Router()
router.route('/public/all').get(courseControllers.fetchPublishedCourses)
router.route('/generate-header/:course').get(courseControllers.generateCourseHeader)
router.route('/public/single/:course').get(courseControllers.fetchSingleCourse)
router.use(auth())
router.get('/', courseControllers.fetchTeamCourses)
router.get('/search', courseControllers.searchTeamCourses)
router.post('/ai', validate(courseValidators.createCourseAi), courseControllers.createCourseAI)
router.post('/ai/generate-outline', validate(courseValidators.generateCourseOutlineAI), courseControllers.generateCourseOutline)

router.post('/file', validate(courseValidators.createCourseAi), courseControllers.createCourseFile)
router.post('/ai/generate-outline-from-file', validate(courseValidators.generateCourseOutlineFile), downloadMiddleware(), courseControllers.generateCourseOutlineFile)

router.post('/', validate(courseValidators.createCourse), courseControllers.createCourseManually)
router.route('/:course')
  .get(courseControllers.fetchTeamSingleCourse)
  .put(validate(courseValidators.updateCourse), courseControllers.updateCourse)
  .post(validate(courseValidators.duplicateCourse), courseControllers.duplicateCourse)
  .delete(courseControllers.deleteCourse)
router.put('/settings/:id', courseControllers.updateCourseSetting)
router.post('/settings/add-learner-group/:id', courseControllers.addLearnerGroup)
router.delete('/settings/remove-learner-group/:id/:groupId', courseControllers.removeLearnerGroup)

router.route('/:course/export-stats')
  .get(courseControllers.exportStats)

router.patch('/settings/launchtimes/:id/:groupId', courseControllers.setLearnerGroupLaunchTime)

// AI apis

//assessment
router.route('/assessments/:course')
  .get(courseControllers.fetchAssessment)
router.route('/assessments-scores/:assessment')
  .get(courseControllers.fetchAssessmentScore)

router.route('/assessments-scores/:course/:student')
  .get(courseControllers.fetchStudentAssessmentScoreByCourse)

export default router

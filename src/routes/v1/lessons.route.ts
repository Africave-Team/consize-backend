import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { courseControllers, courseValidators } from "../../modules/courses"

const router: Router = express.Router()
router.use(auth())
router.post('/:course', validate(courseValidators.createLesson), courseControllers.addLessonToCourse)
router.get('/:course', courseControllers.fetchCourseLessons)
router.get('/:course/:lesson', courseControllers.fetchSingleCourseLesson)
router.delete('/:lesson', courseControllers.deleteCourseLesson)
router.put('/:lesson', validate(courseValidators.updateLesson), courseControllers.updateCourseLesson)
router.get('/blocks/:course/:lesson', courseControllers.fetchLessonsBlocks)
router.get('/quiz/:lesson', courseControllers.fetchLessonsQuiz)
router.post('/quiz/:course/:lesson', validate(courseValidators.createQuiz), courseControllers.addQuizToLesson)
router.delete('/quiz/:lesson/:quiz', courseControllers.deleteQuizFromLesson)


export default router

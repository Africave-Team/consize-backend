import express, { Router } from 'express'
// import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import {
  courseControllers,
  // courseValidators 
} from "../../modules/courses"

const router: Router = express.Router()
router.use(auth())
router.get('/questions-by-course-id/:course/:assessment', courseControllers.fetchQuizQuestionsByCourseId)
router.get('/question-groups/:course', courseControllers.fetchQuestionGroups)
router.get('/question-groups/:course/:assessmentId', courseControllers.singleQuestionsGroup)
router.put('/question-groups/:course/:assessmentId', courseControllers.updateQuestionsGroup)
router.post('/question-groups/:course/:assessmentId', courseControllers.createAssessmentQuiz)
router.delete('/question-groups/:assessmentId', courseControllers.deleteQuestionsGroup)
router.post('/question-groups/:course', courseControllers.createQuestionsGroup)
router.put('/:quiz', courseControllers.updateQuiz)
router.post('/:course/:lesson', courseControllers.createQuiz)

router.get('/questions/:course', courseControllers.fetchQuestion)


export default router

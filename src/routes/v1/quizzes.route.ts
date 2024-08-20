import express, { Router } from 'express'
// import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import {
  courseControllers,
  // courseValidators 
} from "../../modules/courses"

const router: Router = express.Router()
router.use(auth())
router.put('/:quiz', courseControllers.updateQuiz)

router.get('/questions/:course', courseControllers.fetchQuestion)
router.get('/questionGroups/:course', courseControllers.fetchQuestionGroups)
router.post('/questionsGroup/:course', courseControllers.createQuestionsGroup)


export default router

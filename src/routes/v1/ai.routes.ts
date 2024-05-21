import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { generateLessonSection, generateLessonSectionQuiz, rewriteLessonSection, rewriteLessonSectionQuiz } from "../../modules/ai/controllers"
import { generateSection, rewriteSection, SectionQuiz } from '../../modules/ai/validator'

const router: Router = express.Router()
router.use(auth())

router.post('/generate-section', validate(generateSection), generateLessonSection)
router.post('/rewrite-section', validate(rewriteSection), rewriteLessonSection)

router.post('/generate-quiz', validate(SectionQuiz), generateLessonSectionQuiz)
router.post('/rewrite-quiz', validate(SectionQuiz), rewriteLessonSectionQuiz)

export default router

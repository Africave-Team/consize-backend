import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { SurveyControllers, SurveyValidators } from "../../modules/surveys"

const router: Router = express.Router()
router.use(auth())

router.post('/', validate(SurveyValidators.createSurvey), SurveyControllers.createSurveyController)
router.post('/:id', validate(SurveyValidators.createQuestion), SurveyControllers.createSurveyQuestion)

export default router 

import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { SurveyControllers, SurveyValidators } from "../../modules/surveys"

const router: Router = express.Router()
router.use(auth())

router.post('/:id', validate(SurveyValidators.createQuestion), SurveyControllers.createSurveyQuestion)

router.route('/')
  .post(validate(SurveyValidators.createSurvey), SurveyControllers.createSurveyController)
  .get(SurveyControllers.fetchTeamSurveysController)

export default router 

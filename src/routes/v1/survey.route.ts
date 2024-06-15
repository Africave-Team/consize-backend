import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { SurveyControllers, SurveyValidators } from "../../modules/surveys"

const router: Router = express.Router()
router.use(auth())

router.route('/:id')
  .post(validate(SurveyValidators.createQuestion), SurveyControllers.createSurveyQuestion)
  .put(validate(SurveyValidators.createSurvey), SurveyControllers.updateSurvey)
  .delete(SurveyControllers.deleteSurvey)

router.route('/')
  .post(validate(SurveyValidators.createSurvey), SurveyControllers.createSurveyController)
  .get(SurveyControllers.fetchTeamSurveysController)

router.route('/course/:id')
  .get(SurveyControllers.fetchSurveyResponseByCourseID)

router.route('/course/:id/chart')
  .get(SurveyControllers.fetchSurveyResponseChartByCourseID)

export default router 

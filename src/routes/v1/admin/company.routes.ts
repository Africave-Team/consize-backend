import express, { Router } from 'express'
import { validate } from '../../../modules/validate'
import { auth, companyControllers, companyValidators } from '../../../modules/admin'
import { authController } from '../../../modules/auth'

const router: Router = express.Router()
router.use(auth())
router.route('/')
  .get(companyControllers.fetchCompanies)
router.post('/enroll', validate(companyValidators.enroll), companyControllers.enrollCompany)
router.post('/god-mode', validate(companyValidators.godMode), authController.loginTestMode)

router.route('/:teamId')
  .patch(companyControllers.resendOnboardEmail)
  .post(companyControllers.transferCompanyOwnership)

router.route('/:teamId/active-subscription')
  .get(companyControllers.fetchCompanySubscription)
  .post(companyControllers.fetchCompanySubscription)


router.route('/:teamId/activate-subscription')
  .post(companyControllers.subscribeClient)

router.route('/:teamId/extend-subscription')
  .post(companyControllers.extendClientSubscription)
export default router

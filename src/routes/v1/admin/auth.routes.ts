import express, { Router } from 'express'
import { validate } from '../../../modules/validate'
import { authValidation, authController } from '../../../modules/admin'

const router: Router = express.Router()
router.post('/login', validate(authValidation.login), authController.login)
router.post('/logout', validate(authValidation.logout), authController.logout)
router.post('/refresh-tokens', validate(authValidation.refreshTokens), authController.refreshTokens)
router.post('/forgot-password', validate(authValidation.forgotPassword), authController.forgotPassword)
router.post('/reset-password', validate(authValidation.resetPassword), authController.resetPassword)
export default router

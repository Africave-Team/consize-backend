import express, { Router } from 'express'
import { generatorControllers } from "../../modules/generators"

const router: Router = express.Router()

router.get('/:courseId/:studentId', generatorControllers.generateCertificate)

export default router

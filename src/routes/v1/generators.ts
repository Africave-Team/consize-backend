import express, { Router } from 'express'
import { generatorControllers } from "../../modules/generators"

const router: Router = express.Router()

router.get('/certificate/:courseId/:studentId', generatorControllers.generateCertificate)
router.get('/certificate/:courseId/:studentId/url', generatorControllers.getCertificateURL)
router.get('/leaderboard/:courseId/:studentId', generatorControllers.getLeaderboardURL)

export default router

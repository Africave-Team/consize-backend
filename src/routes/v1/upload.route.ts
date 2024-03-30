import express, { Router } from 'express'
import { auth } from '../../modules/auth'
import { uploadFile } from "../../modules/upload/controllers.upload"

const router: Router = express.Router()
router.use(auth())
router.post('/', uploadFile)

export default router

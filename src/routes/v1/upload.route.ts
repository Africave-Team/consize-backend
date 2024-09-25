import express, { Router } from 'express'
// import { auth } from '../../modules/auth'
import { uploadFile, reencodeVideos } from "../../modules/upload/controllers.upload"

const router: Router = express.Router()
// router.use(auth())
router.post('/', uploadFile)
router.post('/re-encode-videos', reencodeVideos)

export default router

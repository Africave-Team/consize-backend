import express, { Router } from 'express'
// import { validate } from '../../modules/validate
import { SlackWebhookHandler } from "../../modules/slack/slack.controllers"

const router: Router = express.Router()

router.route("/webhook").post(SlackWebhookHandler)

export default router

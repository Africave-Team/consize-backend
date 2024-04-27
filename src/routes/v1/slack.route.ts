import express, { Router } from 'express'
// import { validate } from '../../modules/validate
import { SlackWebhookHandler, SlackWebhookChallengeHandler } from "../../modules/slack/slack.controllers"

const router: Router = express.Router()

router.route("/webhook").get(SlackWebhookChallengeHandler).post(SlackWebhookHandler)

export default router

import express, { Router } from 'express'
// import { validate } from '../../modules/validate
import { auth } from '../../modules/auth'
import { slackControllers } from '../../modules/slack'

const router: Router = express.Router()

router.route("/webhook").post(slackControllers.SlackWebhookChallengeHandler)

router.route("/interactivity").post(slackControllers.SlackWebhookHandler)

router.use(auth())
router.post('/token-exchange', slackControllers.SlackTokenExchange)
router.post('/uninstall', slackControllers.SlackUninstall)
router.get('/channels.list', slackControllers.FetchSlackChannels)
router.get("/members.list", slackControllers.FetchSlackMembers)

export default router

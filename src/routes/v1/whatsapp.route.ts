import express, { Router } from 'express'
// import { validate } from '../../modules/validate
import { whatsappWebhookSubscriber, whatsappWebhookMessageHandler } from "../../modules/webhooks/controllers.webhooks"

const router: Router = express.Router()

router.route("/webhook").get(whatsappWebhookSubscriber).post(whatsappWebhookMessageHandler)
export default router

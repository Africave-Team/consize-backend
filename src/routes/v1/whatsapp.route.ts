import express, { Router } from 'express'
// import { validate } from '../../modules/validate
import { whatsappWebhookSubscriber, whatsappWebhookMessageHandler, convertBlockContentToWhatsapp } from "../../modules/webhooks/controllers.webhooks"

const router: Router = express.Router()

router.route("/webhook").get(whatsappWebhookSubscriber).post(whatsappWebhookMessageHandler)

router.get("/convert-block-to-whatsapp/:blockId", convertBlockContentToWhatsapp)
export default router

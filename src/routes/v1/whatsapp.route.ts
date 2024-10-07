import express, { Router } from 'express'
import { auth } from '../../modules/auth'
// import { validate } from '../../modules/validate
import { whatsappWebhookSubscriber, whatsappWebhookMessageHandler, convertBlockContentToWhatsapp, FacebookTokenExchange, FacebookUninstall, ReloadTemplates } from "../../modules/webhooks/controllers.webhooks"

const router: Router = express.Router()

router.route("/webhook").get(whatsappWebhookSubscriber).post(whatsappWebhookMessageHandler)
router.post('/token-exchange', auth(), FacebookTokenExchange)
router.post('/reload-facebook-templates/:teamId', ReloadTemplates)
router.post('/uninstall', auth(), FacebookUninstall)

router.get("/convert-block-to-whatsapp/:blockId", convertBlockContentToWhatsapp)
export default router

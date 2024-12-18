
import express, { Router } from 'express'
// import { validate } from '../../modules/validate
import { auth } from '../../modules/auth'
import { subscriptionControllers } from '../../modules/subscriptions'

const router: Router = express.Router()

router.post("/seed", subscriptionControllers.seedPlans)
router.get('/plans', subscriptionControllers.fetchPlans)
router.use(auth())
router.post('/subscribe', subscriptionControllers.subscribeClient)
router.post('/extend-subscription', subscriptionControllers.extendClientSubscription)
router.get("/active/", subscriptionControllers.myActiveSubscription)


export default router

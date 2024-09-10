import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { userController, userValidation } from "../../modules/user"

const router: Router = express.Router()
router.use(auth())
router.put("/", userController.updateProfileInfo)
router.get("/", userController.getProfileInfo)

router.post("/password", validate(userValidation.updateUserPassword), userController.updateUserPassword)
export default router

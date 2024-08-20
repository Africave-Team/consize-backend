import express, { Router } from "express"
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { cohortsControllers, cohortsValidator } from "../../modules/cohorts"


const router: Router = express.Router()
router.use(auth())

router.post("/", validate(cohortsValidator.createCohorts), cohortsControllers.createCohort)
router.post("/enroll", validate(cohortsValidator.enrollCohorts), cohortsControllers.enrollWithCohort)
router.get("/general/:course", cohortsControllers.getAllCohorts)
router.get("/:course/:distribution", cohortsControllers.getCohorts)

router.route("/single/:id")
  .put(cohortsControllers.UpdateCohorts)
  .delete(cohortsControllers.deleteCohort)


export default router
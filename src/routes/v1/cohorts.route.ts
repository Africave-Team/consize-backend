import express, { Router } from "express";
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { cohortsControllers, cohortsValidator } from "../../modules/cohorts";


const router: Router = express.Router();
router.use(auth());

router.post("/", validate(cohortsValidator), cohortsControllers.createCohort);

export default router
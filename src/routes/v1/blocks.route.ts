import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { courseControllers, courseValidators } from "../../modules/courses"

const router: Router = express.Router()
router.use(auth())

router.post('/:course/:lesson', validate(courseValidators.createBlock), courseControllers.addBlockToLesson)
router.delete('/:block', courseControllers.deleteBlockFromLesson)
router.put('/:block', validate(courseValidators.createBlock), courseControllers.updateBlock)
router.post('/quiz', validate(courseValidators.))

export default router

import express, { Router } from 'express'
import { validate } from '../../modules/validate'
// import { auth } from '../../modules/auth'
import { studentController, studentValidators } from "../../modules/students"

const router: Router = express.Router()
// router.use(auth())
router.post('/bulk-save', studentController.bulkAddStudents)
router
  .route('/')
  .get(validate(studentValidators.fetchStudent), studentController.checkStudentInfo)
  .post(validate(studentValidators.registerStudent), studentController.registerStudent)

router.route('/otp')
  .post(validate(studentValidators.confirmStudentPhoneNumber), studentController.confirmWhatsappOTP)


router.route('/:student/enrollments')
  .post(validate(studentValidators.enrollStudent), studentController.enrollStudentToCourse)

router.post('/test-course/whatsapp', studentController.testCourseWhatsapp)
router.post('/test-course/slack', studentController.testCourseSlack)
export default router

import express, { Router } from 'express'
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { studentController, studentValidators } from "../../modules/students"

const router: Router = express.Router()
router.post('/bulk-save', studentController.bulkAddStudents)

router
  .route('/')
  .get(validate(studentValidators.fetchStudent), studentController.checkStudentInfo)
  .post(validate(studentValidators.registerStudent), studentController.registerStudent)

router.route('/otp')
  .post(validate(studentValidators.confirmStudentPhoneNumber), studentController.confirmWhatsappOTP)

router.route('/check-student-info')
  .get(validate(studentValidators.fetchStudent), studentController.checkStudentInfo)

router.route('/:student/enrollments')
  .post(validate(studentValidators.enrollStudent), studentController.enrollStudentToCourse)

router.post('/test-course/whatsapp', studentController.testCourseWhatsapp)
router.post('/test-course/slack', studentController.testCourseSlack)

router.use(auth())
router
  .route('/all')
  .get(studentController.getAllStudents)

router
  .route('/:course')
  .get(validate(studentValidators.fetchStudentByCourse), studentController.getStudentsByCourse)

export default router

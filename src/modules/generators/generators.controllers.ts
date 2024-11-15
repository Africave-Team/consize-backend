import { Request, Response } from "express"
import { catchAsync } from "../utils"
import httpStatus from "http-status"
import { courseService } from "../courses"
import { teamService } from '../teams'
import { studentService } from '../students'
import { generatorService } from './index'
import Settings from '../courses/model.settings'


export const generateCertificate = catchAsync(async (req: Request, res: Response) => {
  const { courseId, studentId } = req.params
  if (courseId && studentId) {
    generatorService.sendCourseCertificate(courseId, studentId)
    // const course = await courseService.fetchSingleCourse({ courseId })
    // if (!course) {
    //   return res.status(404).send({ message: "Course not found" })
    // }
    // const owner = await teamService.fetchTeamById(course.owner)
    // const student = await studentService.findStudentById(studentId)
    // const settings = await Settings.findById(course.settings)
    // let url = ''
    // if (owner && student && settings) {
    // }
    return res.status(httpStatus.OK).send({ data: "", message: "Your certificate has been created successfully" })
  }
  return res.status(404).send({ message: "Provide course id" })
})

export const getLeaderboardURL = catchAsync(async (req: Request, res: Response) => {
  const { courseId, studentId } = req.params
  if (courseId && studentId) {
    const course = await courseService.fetchSingleCourse({ courseId })
    if (!course) {
      return res.status(404).send({ message: "Course not found" })
    }
    const owner = await teamService.fetchTeamById(course.owner)
    const student = await studentService.findStudentById(studentId)
    let url = ''
    if (owner && student) {
      url = await generatorService.generateCourseLeaderboardURL(course, student, owner)
    }
    return res.status(httpStatus.OK).send({ data: url, message: "Your leader has been created successfully" })
  }
  return res.status(404).send({ message: "Provide course id" })
})

export const getCertificateURL = catchAsync(async (req: Request, res: Response) => {
  const { courseId, studentId } = req.params
  if (courseId && studentId) {
    const course = await courseService.fetchSingleCourse({ courseId })
    if (!course) {
      return res.status(404).send({ message: "Course not found" })
    }
    const owner = await teamService.fetchTeamById(course.owner)
    const student = await studentService.findStudentById(studentId)
    const settings = await Settings.findById(course.settings)
    let url = ''
    if (owner && student && settings) {
      url = await generatorService.generateCourseCertificateURL(course, student, owner, settings)
    }
    return res.status(httpStatus.OK).send({ data: url, message: "Your certificate url has been created successfully" })
  }
  return res.status(404).send({ message: "Provide course id" })
})

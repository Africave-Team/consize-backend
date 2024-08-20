import { Request, Response } from "express"
import { catchAsync } from "../utils"
import { cohortService } from "."
import httpStatus from "http-status"
import { Distribution } from '../courses/interfaces.courses'


export const createCohort = catchAsync(async (req: Request, res: Response) => {
    const cohort = await cohortService.createCohort(req.body)
    res.status(httpStatus.CREATED).send({ message: "Cohort created", data: cohort })
})

export const enrollWithCohort = catchAsync(async (req: Request, res: Response) => {
    const cohort = await cohortService.enrollCohort(req.body)
    res.status(httpStatus.CREATED).send({ message: "Cohort created", data: cohort })
})

export const deleteCohort = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    if (id) {
        await cohortService.deleteCohort(id)
    }
    res.status(httpStatus.CREATED).send({ message: "Cohort deleted" })
})



export const getCohorts = catchAsync(async (req: Request, res: Response) => {

    const { course, distribution } = req.params

    if (course && distribution) {
        const cohorts = await cohortService.fetchCohorts(course, distribution as Distribution)
        res.status(httpStatus.OK).send({ data: cohorts })
    } else {
        res.status(404).send({ message: "Course not found" })
    }

})


export const getAllCohorts = catchAsync(async (req: Request, res: Response) => {

    const { course } = req.params

    if (course) {
        const cohorts = await cohortService.fetchGeneralCohorts(course)
        res.status(httpStatus.OK).send({ data: cohorts })
    } else {
        res.status(404).send({ message: "Course not found" })
    }

})


export const UpdateCohorts = catchAsync(async (req: Request, res: Response) => {

    const { id } = req.params

    if (id) {
        await cohortService.updateCohort(id, req.body)
        res.status(httpStatus.OK).send({ message: "Cohort updated" })
    } else {
        res.status(404).send({ message: "Course not found" })
    }

})
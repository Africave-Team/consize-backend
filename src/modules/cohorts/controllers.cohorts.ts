import { Request, Response } from "express";
import { catchAsync } from "../utils";
import { cohortService } from ".";
import httpStatus from "http-status";
import { courseService } from "../courses";


export const createCohort = catchAsync(async (req: Request, res: Response) => {
    const course = await courseService.fetchSingleTeamCourse({ teamId: req.user.team, courseId: req.body.course_id })

    if (!course) {
         res.status(404).send({ message: "Course not found" })
    }
    const createdCohort = await cohortService.createCohort(req.body)
    await courseService.updateCourse({currentCohort: createdCohort._id},req.body.course_id,req.user.team)
    res.status(httpStatus.CREATED).send({ data: createdCohort, message: "Your cohort has been created successfully" })
})

export const getCohorts = catchAsync(async (req: Request, res: Response) => {
    
    const { course } = req.params

    if ( course) {
        const cohorts = await cohortService.fetchCohorts(course)
        res.status(httpStatus.OK).send({ cohorts: cohorts })
    } else {
        res.status(404).send({ message: "Course not found" }) 
    }
   
})
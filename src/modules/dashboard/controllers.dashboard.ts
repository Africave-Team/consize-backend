import { Request, Response } from "express"
import { catchAsync } from "../utils"
import { dashboardService } from "."
import httpStatus from "http-status"


// export const courseMetrics = catchAsync(async (req: Request, res: Response) => {
//     const cohort = await dashboardService.getCourseStat(req.query,req.user.team)
//     res.status(httpStatus.CREATED).send({ message: "Certificate created", data: cohort })
// })

export const learnersMetrics = catchAsync(async (req: Request, res: Response) => {
    const learnersStats = await dashboardService.getLearnersStat(req.query, req.user.team)
    res.status(httpStatus.CREATED).send({ message: "Learners metrics", data: learnersStats })
})

// export const assessmentMetrics = catchAsync(async (req: Request, res: Response) => {
//     const cohort = await dashboardService.getAssessmentStat(req.query, req.user.team)
//     res.status(httpStatus.CREATED).send({ message: "Certificate created", data: cohort })
// })
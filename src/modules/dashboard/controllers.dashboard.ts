import { Request, Response } from "express"
import { catchAsync } from "../utils"
import { dashboardService } from "."
import httpStatus from "http-status"


export const courseMetrics = catchAsync(async (req: Request, res: Response) => {
    const courseMetrics = await dashboardService.getCourseStat(req.query,req.user.team)
    res.status(httpStatus.OK).send({ message: "course stats", data: courseMetrics })
})

export const learnersMetrics = catchAsync(async (req: Request, res: Response) => {
    const learnersStats = await dashboardService.getLearnersStat(req.query, req.user.team)
    res.status(httpStatus.OK).send({ message: "Learners metrics", data: learnersStats })
})

export const assessmentMetrics = catchAsync(async (req: Request, res: Response) => {
    const assessmentStats = await dashboardService.getAssessmentStat(req.query, req.user.team)
    res.status(httpStatus.OK).send({ message: "assessment stats", data: assessmentStats })
})

export const graphMetrics = catchAsync(async (req: Request, res: Response) => {
    const graphStats = await dashboardService.getAssessmentStat(req.query, req.user.team)
    res.status(httpStatus.OK).send({ message: "graph stats", data: graphStats })
})

export const topCourseMetrics = catchAsync(async (req: Request, res: Response) => {
    const topCourseMetrics = await dashboardService.getTopCourseMetrics(req.user.team)
    res.status(httpStatus.OK).send({ message: "Course metrics retrieved", data: topCourseMetrics })
})

export const topLevelMetrics = catchAsync(async (req: Request, res: Response) => {
    const topLevelStats = await dashboardService.getAssessmentStat(req.query, req.user.team)
    res.status(httpStatus.OK).send({ message: "Certificate created", data: topLevelStats })
})
import { CohortsInterface, CreateCohortInterface } from "./interface.cohorts"
import Cohorts from "./model.cohorts"

export const createCohort = async (cohortPayload: CreateCohortInterface): Promise<CohortsInterface> => {
    const cohort = new Cohorts({ ...cohortPayload });
    await cohort.save()
    return cohort
}

export const fetchCohorts = async (courseId: string): Promise<CohortsInterface[]> => {
    const cohorts = await Cohorts.find({ courseId: courseId })
    return cohorts
}
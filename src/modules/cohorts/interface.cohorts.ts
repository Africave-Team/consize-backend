import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'
import { Distribution } from '../courses/interfaces.courses'

export enum CohortsStatus {
    PENDING = "pending",
    ACTIVE = "active",
    DISABLED = "disabled"
}

export interface CohortsInterface extends Document {
    _id: string,
    name: string,
    distribution: Distribution
    schedule: boolean
    members: string[]
    courseId: string,
    date?: Date,
    time?: string,
    status: CohortsStatus
}

export interface CreateCohortInterface {
    distribution: Distribution
    schedule: boolean
    students?: string[]
    channels?: string[]
    members?: string[]
    name: string,
    courseId: string,
    date?: Date,
    time?: string,
}

export interface CohortsInterfaceModel extends Model<CohortsInterface> {
    paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<CohortsInterface>>
}
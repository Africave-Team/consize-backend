import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

export enum CohortsStatus {
    ACTIVE = "active",
    DISABLED = "disabled"
}

export interface CohortsInterface extends Document{
    "_id": string,
    "name": string,
    "courseId": string,
    "startDate"?: Date,
    "endDate"?: Date,
    "status"?: CohortsStatus
} 

export interface CreateCohortInterface {
    "name": string,
    "courseId": string,
    "startDate"?: Date,
    "endDate"?: Date,
}

export interface CohortsInterfaceModel extends Model<CohortsInterface> {
    paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<CohortsInterface>>
}
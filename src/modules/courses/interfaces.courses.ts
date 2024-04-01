import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

export enum MediaType {
    AUDIO = 'audio',
    VIDEO = 'video',
    IMAGE = 'image'
}
export interface Media {
    awsFileKey: string
    mediaType: MediaType
    url: string
}

export enum CourseStatus {
    DRAFT = "draft",
    COMPLETED = "completed",
    PUBLISHED = "published",
    DELETED = "deleted"
}

export enum Sources {
    MANUAL = "manual",
    AI = "ai"
}

interface Course {
    title: string
    description: string
    owner: string
    lessons: string[]
    courses: string[]
    headerMedia: Media
    status: CourseStatus
    free: boolean
    settings: string
    bundle: boolean
    private: boolean
    source: Sources
    price?: number
    currentCohort?: string
    audiences?: string
}

export interface CreateCoursePayload {
    free: boolean
    bundle: boolean
    private: boolean
    headerMedia: Media
    title: string
    description: string
    price?: number
    audiences?: string
    currentCohort?: string
}

export interface CourseInterface extends Course, Document {
    _id: string
    createdAt?: Date
    updatedAt?: Date
}


export interface CourseInterfaceModel extends Model<CourseInterface> {
    paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<CourseInterface>>
}
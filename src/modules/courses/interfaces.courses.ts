import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'
import { LessonInterface } from './interfaces.lessons'
import { QuestionGroupsInterface } from './interfaces.question-group'

export enum MediaType {
    AUDIO = 'audio',
    VIDEO = 'video',
    IMAGE = 'image',
    TEXT = "text"
}
export enum Distribution {
    SLACK = 'slack',
    WHATSAPP = 'whatsapp',
}
export interface Media {
    awsFileKey?: string
    mediaType: MediaType
    url: string
    embedUrl?: string
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

export interface CourseContent {
    lesson: string | LessonInterface | null
    assessment: string | QuestionGroupsInterface | null

}

interface Course {
    title: string
    description: string
    owner: string
    lessons: string[]
    contents: CourseContent[]
    courses: string[]
    headerMedia: Media
    status: CourseStatus
    free: boolean
    settings: string
    shortCode: string
    bundle: boolean
    private: boolean
    source: Sources
    price?: number
    currentCohort?: string
    survey?: string
    library?: boolean
}

export interface CreateCoursePayload {
    free: boolean
    bundle: boolean
    private: boolean
    headerMedia: Media
    title: string
    description: string
    source?: Sources
    price?: number
    status?: CourseStatus
    currentCohort?: string
    survey?: string
    courses?: string[]
    contents: CourseContent[]
    lessons?: string[]
    library?: boolean
}

export interface CourseInterface extends Course, Document {
    _id: string
    createdAt?: Date
    updatedAt?: Date
}


export interface CourseInterfaceModel extends Model<CourseInterface> {
    paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<CourseInterface>>
}
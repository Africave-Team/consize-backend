import { CourseInterface, CourseInterfaceModel, CourseStatus, Media, MediaType, Sources } from './interfaces.courses'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'

export const MediaSchema = new Schema<Media>(
    {
        awsFileKey: {
            type: String
        },
        url: {
            type: String,
        },
        mediaType: {
            type: String,
            enum: Object.values(MediaType),
            default: MediaType.IMAGE
        }
    },
    {
        _id: false,
        timestamps: false
    }
)

const CourseSchema = new Schema<CourseInterface, CourseInterfaceModel>(
    {
        _id: { type: String, default: () => v4() },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String
        },
        status: {
            type: String,
            enum: Object.values(CourseStatus),
            default: CourseStatus.DRAFT
        },
        source: {
            type: String,
            enum: Object.values(Sources),
            default: Sources.MANUAL
        },
        headerMedia: {
            type: MediaSchema
        },
        owner: {
            type: String
        },
        free: {
            type: Boolean
        },
        bundle: {
            type: Boolean
        },
        price: {
            type: Number
        },
        settings: {
            type: String,
            ref: "Settings"
        },
        courses: {
            type: [String],
            default: [],
            ref: "Courses"
        },
        lessons: {
            type: [String],
            default: [],
            ref: "Lessons"
        },
        audiences: {
            type: String,
        },
        currentCohort: {
            type: String,
            ref: "Cohorts"
        },
        private: {
            type: Boolean
        },
    },
    {
        collection: 'courses',
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)
CourseSchema.index({ title: 1, description: 1 })
CourseSchema.plugin(toJSON)
CourseSchema.plugin(paginate)

const Courses = mongoose.model<CourseInterface, CourseInterfaceModel>('Courses', CourseSchema)

export default Courses

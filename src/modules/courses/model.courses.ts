import { CourseInterface, CourseInterfaceModel, CourseStatus, Media, MediaType, Sources } from './interfaces.courses'
import mongoose, { Schema } from 'mongoose'
import { agenda } from '../scheduler'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'
import { GENERATE_COURSE_TRENDS } from '../scheduler/MessageTypes'

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
            type: String,
            ref: "Teams"
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
        survey: {
            type: String
        }
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

Courses.watch().
    on('change', async (data: {
        operationType: string,
        documentKey: { _id: string },
        updateDescription?: {
            updatedFields: {
                status: CourseStatus
            }
        }
    }) => {
        if (data.updateDescription && data.updateDescription.updatedFields && data.updateDescription.updatedFields.status && data.updateDescription.updatedFields.status === CourseStatus.PUBLISHED) {
            let courseId = data.documentKey._id.toString()
            const jobs = await agenda.jobs({ 'data.courseId': courseId })
            jobs.forEach(async (job) => {
                await job.remove()
                console.log('Cancelled job:', job.attrs._id)
            })
            const course = await Courses.findById(courseId)
            if (course) {
                // Queue the trends generator
                agenda.every("15 minutes", GENERATE_COURSE_TRENDS, {
                    courseId,
                    teamId: course.owner
                })
            }
        }
    })

export default Courses

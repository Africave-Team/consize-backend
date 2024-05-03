import { CourseInterface, CourseInterfaceModel, CourseStatus, Distribution, Sources } from './interfaces.courses'
import mongoose, { Schema } from 'mongoose'
import { agenda } from '../scheduler'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'
import { GENERATE_COURSE_TRENDS, COHORT_SCHEDULE } from '../scheduler/MessageTypes'
import { MediaSchema } from './model.media'
import { Cohorts } from '../cohorts'
import { CohortsStatus } from '../cohorts/interface.cohorts'



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
        distribution: {
            type: String,
            enum: Object.values(Distribution),
            default: Distribution.WHATSAPP
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
            // get all cohorts for this course whose status is still pending
            const cohorts = await Cohorts.find({ courseId, status: CohortsStatus.PENDING, $or: [{ schedule: false }, { schedule: { $exists: false } }] })
            for (let coh of cohorts) {
                agenda.now<{ cohortId: string }>(COHORT_SCHEDULE, { cohortId: coh.id })
            }
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

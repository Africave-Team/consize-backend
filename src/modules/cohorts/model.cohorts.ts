import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'
import { CohortsInterface, CohortsInterfaceModel, CohortsStatus } from './interface.cohorts'
import { Distribution } from '../courses/interfaces.courses'

const CohortSchema = new Schema<CohortsInterface, CohortsInterfaceModel>(
    {
        _id: { type: String, default: () => v4() },
        name: {
            type: String
        },
        courseId: {
            type: String,
        },
        schedule: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: Object.values(CohortsStatus),
            default: CohortsStatus.ACTIVE
        },
        distribution: {
            type: String,
            enum: Object.values(Distribution),
            default: Distribution.SLACK
        },
        members: {
            type: [String],
            ref: "Students"
        },
        date: {
            type: Date,
        },
        shortCode: {
            type: String
        },
        time: {
            type: String,
        },
        global: {
            type: Boolean,
            default: false
        },

    },
    {
        collection: 'cohorts',
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)
CohortSchema.index({ title: 1, description: 1 })
CohortSchema.plugin(toJSON)
CohortSchema.plugin(paginate)

const Cohorts = mongoose.model<CohortsInterface, CohortsInterfaceModel>('Cohorts', CohortSchema)

export default Cohorts

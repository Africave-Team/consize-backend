import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'
import { CohortsInterface, CohortsInterfaceModel, CohortsStatus } from './interface.cohorts'

const CohortSchema = new Schema<CohortsInterface, CohortsInterfaceModel>(
    {
        _id: { type: String, default: () => v4() },
        name: {
            type: String
        },
        courseId: {
            type: String,
        },
        status: {
            type: String,
            enum: Object.values(CohortsStatus),
            default: CohortsStatus.ACTIVE
        },
        startDate: {
            type: String,
        },
        endDate: {
            type: String,
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

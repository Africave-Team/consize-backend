import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'
import { SignatureInterface, SignatureInterfaceModel, SignaturesStatus } from './interface.signatures'

const CohortSchema = new Schema<SignatureInterface, SignatureInterfaceModel>(
    {
        _id: { type: String, default: () => v4() },
        name: {
            type: String
        },
        email: {
            type: String,
        },
        position: {
            type: String,
        },
        status: {
            type: String,
            enum: Object.values(SignaturesStatus),
            default: SignaturesStatus.PENDING
        },
        signature: {
            type: String,
        },

    },
    {
        collection: 'signatures',
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)
CohortSchema.index({ title: 1, description: 1 })
CohortSchema.plugin(toJSON)
CohortSchema.plugin(paginate)

const Signatures = mongoose.model<SignatureInterface, SignatureInterfaceModel>('Cohorts', CohortSchema)

export default Signatures

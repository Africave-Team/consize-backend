import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'
import { CertificatesInterface, CertificatesInterfaceModel, CertificatesStatus } from './interface.certificates'

const CertificatesSchema = new Schema<CertificatesInterface, CertificatesInterfaceModel>(
    {
        _id: { type: String, default: () => v4() },
        template: {
            type: String
        },
        teamId: {
            type: String,
        },
        status: {
            type: String,
            enum: Object.values(CertificatesStatus),
            default: CertificatesStatus.ACTIVE
        },
        colors: {
            type: [String],
        },
        text: {
            type: [String],
        },
        signatories: {
            type: [String],
        },

    },
    {
        collection: 'certificates',
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)
// CertificatesSchema.index({ title: 1, description: 1 })
CertificatesSchema.plugin(toJSON)
CertificatesSchema.plugin(paginate)

const Certificates = mongoose.model<CertificatesInterface, CertificatesInterfaceModel>('Certificates', CertificatesSchema)

export default Certificates

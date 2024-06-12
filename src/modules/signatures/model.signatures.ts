import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { SignatureInterface, SignatureInterfaceModel, SignaturesStatus } from './interface.signatures'

const SignatureSchema = new Schema<SignatureInterface, SignatureInterfaceModel>(
    {
        _id: { type: String, default: () => v4() },
        owner: {
            type: String,
            ref: "Teams"
        },
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
        deleted: {
            type: Boolean,
            default: false
        },
        deletedAt: {
            type: Date,
            default: null
        },

    },
    {
        collection: 'signatures',
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

const Signatures = mongoose.model<SignatureInterface, SignatureInterfaceModel>('Signatures', SignatureSchema)

export default Signatures

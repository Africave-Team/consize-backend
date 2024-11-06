import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'
import { CertificatesInterface, CertificatesInterfaceModel, CertificatesStatus, ComponentTypes, TextAlign } from './interface.certificates'


// Submodel for the radius field
const RadiusSchema = new Schema({
    rt: { type: Number, required: true },
    rb: { type: Number, required: true },
    lb: { type: Number, required: true },
    lt: { type: Number, required: true }
}, { _id: false })

// Submodel for the border field
const BorderSchema = new Schema({
    r: { type: Number, required: true },
    b: { type: Number, required: true },
    l: { type: Number, required: true },
    t: { type: Number, required: true },
    color: { type: String, required: true }
}, { _id: false })

// Submodel for the text field
const TextSchema = new Schema({
    size: { type: Number, required: true },
    weight: { type: Number, required: true },
    family: { type: String, required: true },
    color: { type: String, required: true },
    value: { type: String, required: true },
    align: { type: String, enum: Object.values(TextAlign), required: true }
}, { _id: false })

// Submodel for the element properties
const ElementPropertiesSchema = new Schema({
    height: { type: Schema.Types.Mixed, required: true }, // Can be a number or "auto"
    width: { type: Schema.Types.Mixed, required: true }, // Can be a number or "auto"
    size: { type: Number, required: true },
    leftSize: { type: Number, required: true },
    rightSize: { type: Number, required: true },
    bottomSize: { type: Number, required: true },
    color: { type: String, required: true },
    radius: { type: RadiusSchema, required: true },
    border: { type: BorderSchema, required: false },
    text: { type: TextSchema, required: false },
    url: { type: String, required: false }
}, { _id: false })

// Submodel for the certificate components
const CertificateComponentSchema = new Schema({
    type: { type: String, enum: Object.values(ComponentTypes), required: true },
    position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true }
    },
    properties: { type: ElementPropertiesSchema, required: true },
    default: { type: String, required: false }
}, { _id: false })

// Submodel for the certificate template
const CertificateTemplateSchema = new Schema({
    name: { type: String, required: false },
    bg: { type: String, required: true },
    components: [CertificateComponentSchema]
}, { _id: false })

const CertificatesSchema = new Schema<CertificatesInterface, CertificatesInterfaceModel>(
    {
        _id: { type: String, default: () => v4() },
        name: {
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
            default: []
        },
        text: {
            type: [String],
            default: []
        },
        signatories: {
            type: [String],
            ref: "Signatures"
        },
        components: { type: CertificateTemplateSchema }

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

import { DistributionChannel, ITeamModel, TeamsInterface, FacebookIntegrationData } from './interfaces.teams'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'
import { Distribution } from '../courses/interfaces.courses'
const defaultColors = ['#3b5998', '#1da1f2', '#e1306c', '#c13584', '#0077b5', '#ea4335', '#1db954', '#e50914', '#ff0000', '#ff9900', '#611f69']

const ChannelSchema = new Schema<DistributionChannel>(
    {
        channel: {
            type: String,
            enum: Object.values(Distribution)
        },
        enabled: {
            type: Boolean
        },
        token: {
            type: String
        }
    },
    {
        _id: false
    }
)

const FacebookDataSchema = new Schema<FacebookIntegrationData>(
    {
        status: {
            type: String,
            enum: ["PENDING", "CONFIRMED", "DEACTIVATED"],
            default: "PENDING"
        },
        businessId: {
            type: String
        },
        phoneNumberId: {
            type: String
        },
        phoneNumber: {
            type: String
        },
        token: {
            type: String
        }
    },
    {
        _id: false
    }
)


export const TeamSchema = new Schema<TeamsInterface, ITeamModel>(
    {
        _id: { type: String, default: () => v4() },
        status: {
            type: String,
            enum: ["PENDING", "CONFIRMED", "DEACTIVATED", "ACTIVATED"],
            default: "PENDING"
        },
        name: {
            type: Schema.Types.String
        },
        shortCode: {
            type: String
        },
        channels: {
            type: [ChannelSchema]
        },
        logo: {
            type: Schema.Types.String
        },
        slackToken: {
            type: Schema.Types.String
        },
        facebookToken: {
            type: Schema.Types.String
        },
        facebookBusinessId: {
            type: Schema.Types.String
        },
        facebookPhoneNumberId: {
            type: Schema.Types.String
        },
        facebookData: {
            type: FacebookDataSchema
        },
        defaultCertificateId: {
            type: String
        },
        certificateBackgrounds: {
            type: [String]
        },
        owner: {
            type: String,
            ref: "User"
        },
        color: {
            primary: {
                type: String,
                default: () => defaultColors[Math.floor(Math.random() * defaultColors.length)]
            },
            secondary: {
                type: String,
                default: () => defaultColors[Math.floor(Math.random() * defaultColors.length)]
            },
        },
        verified: {
            type: Boolean,
            default: false
        }
    },
    {
        collection: 'teams',
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)
TeamSchema.plugin(paginate)
TeamSchema.plugin(toJSON)


const Teams = mongoose.model<TeamsInterface, ITeamModel>('Teams', TeamSchema)

export default Teams

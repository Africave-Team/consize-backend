import { ITeamModel, TeamsInterface } from './interfaces.teams'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'

export const TeamSchema = new Schema<TeamsInterface, ITeamModel>(
    {
        _id: { type: String, default: () => v4() },
        name: {
            type: Schema.Types.String
        },
        shortCode: {
            type: String
        },
        logo: {
            type: Schema.Types.String
        },
        slackToken: {
            type: Schema.Types.String
        },
        owner: {
            type: String,
            ref: "User"
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

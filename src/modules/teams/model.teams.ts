import { TeamsInterface } from './interfaces.teams'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'

export const TeamSchema = new Schema<TeamsInterface>(
    {
        _id: { type: String, default: () => v4() },
        name: {
            type: Schema.Types.String
        },
        logo: {
            type: Schema.Types.String
        },
        owner: {
            type: String
        }
    },
    {
        collection: 'teams',
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
    }
)

TeamSchema.plugin(toJSON)


const Teams = mongoose.model<TeamsInterface>('Teams', TeamSchema)

export default Teams

import { Document, Model } from 'mongoose'
import { IUser, IUserDoc } from '../user/user.interfaces'
import { QueryResult } from '../paginate/paginate'
import { Distribution } from '../courses/interfaces.courses'

export interface TeamsInterface extends Document {
    _id: string
    name: string
    shortCode: string
    verified: boolean
    owner: string
    slackToken: string | null
    channels: DistributionChannel[]
    logo?: string
    createdAt?: Date
    updatedAt?: Date
}

export interface DistributionChannel {
    channel: Distribution,
    enabled: boolean
    token?: string
}

export interface TeamInterfaceWithOwner extends Omit<TeamsInterface, 'owner'> {
    owner: IUserDoc
}


export interface ITeamDoc extends TeamsInterface {

}

export interface ITeamModel extends Model<ITeamDoc> {
    paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<ITeamDoc>>
}

export type NewTeamUser = Omit<IUser, 'isEmailVerified' | 'team' | 'password' | 'avatar'>
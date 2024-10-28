import { Document, Model } from 'mongoose'
import { IUser, IUserDoc } from '../user/user.interfaces'
import { QueryResult } from '../paginate/paginate'
import { Distribution } from '../courses/interfaces.courses'


export interface FacebookIntegrationData {
    businessId: string
    phoneNumberId: string
    phoneNumber: string
    token: string | null
    status: "PENDING" | "CONFIRMED"
}
export interface TeamsInterface extends Document {
    _id: string
    name: string
    shortCode: string
    verified: boolean
    owner: string
    slackToken: string | null
    facebookToken: string | null
    facebookBusinessId: string | null
    facebookPhoneNumberId: string | null
    facebookData: FacebookIntegrationData | null
    channels: DistributionChannel[]
    status?: "PENDING" | "CONFIRMED" | "DEACTIVATED" | "ACTIVATED"
    defaultCertificateId?: string
    logo?: string
    color?: {
        primary: string
        secondary: string
    },
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
import { Document } from 'mongoose'
import { IUser } from '../user/user.interfaces'

export interface TeamsInterface extends Document {
    _id: string
    name: string
    owner: string
    slackToken?: string
    logo?: string
    createdAt?: Date
    updatedAt?: Date
}


export interface ITeamDoc extends TeamsInterface {

}

export type NewTeamUser = Omit<IUser, 'isEmailVerified' | 'team' | 'password' | 'avatar'>
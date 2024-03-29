import { Model, Document } from 'mongoose'
import { QueryResult } from '../paginate/paginate'
import { AccessAndRefreshTokens } from '../token/token.interfaces'
import { IPG } from '../permission-groups/pg.interfaces'

export interface IUser {
  name: string
  team: string
  email: string
  avatar?: string
  permissionGroup: IPG
  password: string
  isEmailVerified: boolean
}

export interface IUserDoc extends IUser, Document {
  isPasswordMatch (password: string): Promise<boolean>
}

export interface IUserModel extends Model<IUserDoc> {
  isEmailTaken (email: string, excludeUserId?: string): Promise<boolean>
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<IUserDoc>>
}

export type UpdateUserBody = Partial<IUser>

export type NewRegisteredUser = Omit<IUser, 'permissionGroup' | 'isEmailVerified' | 'team' | 'avatar'>

export type NewCreatedUser = Omit<IUser, 'isEmailVerified'>

export interface IUserWithTokens {
  user: IUserDoc
  tokens: AccessAndRefreshTokens
}

import { Model, Document } from 'mongoose'
import { QueryResult } from '../paginate/paginate'
import { AccessAndRefreshTokens } from '../token/token.interfaces'
import { IPG } from '../permission-groups/pg.interfaces'

export interface IAdmin {
  name: string
  email: string
  avatar?: string
  permissionGroup: IPG
  password: string
  isEmailVerified: boolean
}

export interface IAdminDoc extends IAdmin, Document {
  isPasswordMatch (password: string): Promise<boolean>
}

export interface IAdminModel extends Model<IAdminDoc> {
  isEmailTaken (email: string, excludedId?: string): Promise<boolean>
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<IAdminDoc>>
}

export type UpdateAdminBody = Partial<IAdmin>

export type NewRegisteredAdmin = Omit<IAdmin, 'permissionGroup' | 'isEmailVerified' | 'team' | 'avatar'>

export type NewCreatedAdmin = Omit<IAdmin, 'isEmailVerified'>

export interface IAdminWithTokens {
  user: IAdminDoc
  tokens: AccessAndRefreshTokens
}

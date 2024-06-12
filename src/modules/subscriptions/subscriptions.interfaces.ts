import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'
import { SubscriptionPlan } from './plans.interfaces'
import { TeamsInterface } from '../teams/interfaces.teams'

export enum SubscriptionStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  GRACE = "grace-period"
}
export interface Subscription {
  owner: string | TeamsInterface
  plan: string | SubscriptionPlan
  status: SubscriptionStatus
  expires: Date
  deleted?: boolean
  deletedAt?: Date
}

export interface SubscribePayload {
  planId: string
  numberOfMonths: number
}

export interface SubscriptionInterface extends Subscription, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface SubscriptionInterfaceModel extends Model<SubscriptionInterface> {
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<SubscriptionInterface>>
}

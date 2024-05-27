import { Document, Model } from 'mongoose'
import { PeriodTypes } from '../courses/interfaces.settings'

export enum PlanPeriods {
  MONTHLY = "monthly",
  ANNUALLY = "annually"
}

export interface SubscriptionPlan {
  name: string
  description: string
  price: number
  period: PlanPeriods
  gracePeriod?: {
    value: number,
    period: PeriodTypes
  }
}

export interface SubscriptionPlanInterface extends SubscriptionPlan, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface SubscriptionPlanInterfaceModel extends Model<SubscriptionPlanInterface> {
}

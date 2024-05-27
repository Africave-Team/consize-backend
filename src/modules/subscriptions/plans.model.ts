
import mongoose, { Schema } from 'mongoose'
import { v4 } from 'uuid'
import { toJSON } from '../toJSON'
import { SubscriptionPlanInterface, SubscriptionPlanInterfaceModel, PlanPeriods } from './plans.interfaces'
import { PeriodTypes } from '../courses/interfaces.settings'

const GraceSchema = new Schema({
  value: {
    type: Number
  },
  period: {
    type: String,
    enum: Object.values(PeriodTypes),
    default: PeriodTypes.DAYS
  }
}, {
  _id: false,
  timestamps: false
})

const planSchema = new Schema<SubscriptionPlanInterface, SubscriptionPlanInterfaceModel>({
  _id: { type: String, default: () => v4() },
  disabled: { type: Boolean, default: false },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  period: { type: String, enum: Object.values(PlanPeriods), default: PlanPeriods.MONTHLY },
  gracePeriod: {
    type: GraceSchema
  }
}, {
  collection: "subscription-plans"
})

planSchema.plugin(toJSON)

const SubscriptionPlans = mongoose.model<SubscriptionPlanInterface, SubscriptionPlanInterfaceModel>('Plans', planSchema)

export default SubscriptionPlans


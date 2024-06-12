
import mongoose, { Schema } from 'mongoose'
import { v4 } from 'uuid'
import { paginate } from '../paginate'
import { toJSON } from '../toJSON'
import { SubscriptionInterface, SubscriptionInterfaceModel, SubscriptionStatus } from './subscriptions.interfaces'

const subSchema = new Schema<SubscriptionInterface, SubscriptionInterfaceModel>({
  _id: { type: String, default: () => v4() },
  owner: {
    type: String,
    required: true,
    ref: "Teams"
  },
  plan: {
    type: String,
    required: true,
    ref: "Plans"
  },
  status: {
    required: true,
    type: String,
    enum: Object.values(SubscriptionStatus),
    default: SubscriptionStatus.ACTIVE
  },
  expires: {
    required: true,
    type: Date
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
}, {
  collection: "subscriptions"
})

subSchema.plugin(toJSON)
subSchema.plugin(paginate)

const Subscriptions = mongoose.model<SubscriptionInterface, SubscriptionInterfaceModel>('Subscriptions', subSchema)

export default Subscriptions


import { TransitionMessagesInterface, TransitionMessageInterfaceModel } from './interfaces.transition-messages'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'

const TransitionMessageSchema = new Schema<TransitionMessagesInterface, TransitionMessageInterfaceModel>(
  {
    _id: { type: String, default: () => v4() },
    message: { type: String },
    type: { type: String },
    course: {
      type: String,
      required: true
    }

  },
  {
    collection: 'transition-message',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

TransitionMessageSchema.plugin(toJSON)
TransitionMessageSchema.plugin(paginate)

const TransitionMessage = mongoose.model<TransitionMessagesInterface, TransitionMessageInterfaceModel>('TransitionMessages', TransitionMessageSchema)

export default TransitionMessage

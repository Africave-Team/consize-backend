import mongoose, { Schema } from 'mongoose'
import { v4 } from 'uuid'
import { RemindersInterface } from './schedulers.interfaces'

const reminderSchema = new Schema<RemindersInterface>({
  _id: { type: String, default: () => v4() },
  student: {
    type: String,
  },
  course: {
    type: String
  },
  lastActivity: {
    type: Date
  },
  dailyCount: {
    type: Number
  }
}, {
  collection: "reminders"
})

const Reminders = mongoose.model<RemindersInterface>('Reminders', reminderSchema)

export default Reminders
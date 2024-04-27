import { Document } from 'mongoose'

export interface Reminders {
  course: string
  student: string
  dailyCount: number
  lastActivity: Date
}

export interface RemindersInterface extends Reminders, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}


export interface CreateRemindersPayload {

}

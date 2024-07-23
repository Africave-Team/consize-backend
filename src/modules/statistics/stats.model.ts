
import mongoose, { Schema } from 'mongoose'
import { v4 } from 'uuid'
import { toJSON } from '../toJSON'
import { DailyStatsModelInterface, DailyStatsModelInterfaceModel } from './stats.interfaces'

const statsSchema = new Schema<DailyStatsModelInterface, DailyStatsModelInterfaceModel>({
  _id: { type: String, default: () => v4() },
  studentId: String,
  courseId: String,
  teamId: String,
  // stats values
  date: {
    type: Date
  },
  testScore: {
    type: Number,
    default: 0
  },
  retakeRate: {
    type: Number,
    default: 0
  },
  baselineScore: {
    type: Number,
    default: 0
  },
  endlineScore: {
    type: Number,
    default: 0
  },
  progress: {
    type: Number,
    default: 0
  },
  completionTime: {
    type: Number,
    default: 0
  },
  lessonDuration: {
    type: Number,
    default: 0
  },
  blockDuration: {
    type: Number,
    default: 0
  },

}, {
  collection: "statistics",
  timestamps: true
})

statsSchema.plugin(toJSON)

const Statistics = mongoose.model<DailyStatsModelInterface, DailyStatsModelInterfaceModel>('Statistics', statsSchema)

export default Statistics


import { Document, Model } from 'mongoose'

export interface DailyStatsModel {
  courseId: string
  teamId: string
  studentId: string
  testScore: number
  retakeRate: number
  baselineScore: number
  endlineScore: number
  progress: number
  completionTime: number
  lessonDuration: number
  blockDuration: number
}



export interface DailyStatsModelInterface extends DailyStatsModel, Document {
  _id: string
  date: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface DailyStatsModelInterfaceModel extends Model<DailyStatsModelInterface> {
}


export interface DailyStatsServiceInput {
  teamId: string
  courseId?: string
  start: string
  end: string
}
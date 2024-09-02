import { Document, Model } from 'mongoose'

export interface Assessment {
  courseId: string
  teamId?: string
  studentId: string
  assessmentId: string
  score: number
}



export interface AssessmentInterface extends Assessment, Document {
  _id: string
  date: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface AssessmentInterfaceModel extends Model<AssessmentInterface> {
}



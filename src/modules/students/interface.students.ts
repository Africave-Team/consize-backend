import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

export interface Student {
  verified: boolean
  rejected: boolean
  firstName: string
  otherNames: string
  phoneNumber: string
  slackId: string
  channelId: string
  email: string
  tz: string
  anonymous: boolean
  custom?: any
}

export interface StudentInterface extends Student, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface StudentInterfaceModel extends Model<StudentInterface> {
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<StudentInterface>>
}


export interface CreateStudentPayload {
  email: string
  phoneNumber: string
  firstName: string
  otherNames: string
  tz: string
  slackId?: string
  custom?: any
}

export interface StudentCourseStats {
  name: string
  studentId: string
  phoneNumber: string
  slackId?: string
  anonymous: boolean
  completed?: boolean
  droppedOut?: boolean
  certificate?: string
  distribution?: string
  progress: number
  scores: number[]
  custom?: any
  cohortId?: string
  totalScore?: number
  lessons: {
    [lessonId: string]: {
      duration: number
      title: string
      blocks: {
        [blockId: string]: {
          duration: number
        }
      },
      quizzes: {
        [quizId: string]: {
          duration: number
          retakes: number
          score: number
        }
      }
    }
  }
}
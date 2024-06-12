import { Model, Document } from 'mongoose'
import { StudentCourseStats } from '../students/interface.students'

export interface SessionsRTDB {
  [sessionId: string]: {
    studentId: string
    studentName: string
    phoneNumber: string
    progress: number
    performance: number
    durations: {
      [lessonIndex: string]: number[] // array of the durations on all the blocks within that lesson
    },
    quizzes: {
      scores: {
        [lessonIndex: string]: number // the scores on all the lesson quizzes
      }
      durations: {
        [lessonIndex: string]: number[] // array of the durations on all the questions within that lesson quiz
      },
      retakes: {
        [lessonIndex: string]: number[]
      }
    }
  }
}

export interface EnrollmentSession extends StudentCourseStats {
  studentId: string
  courseId: string
  teamId: string
}


export interface EnrollmentSessionInterface extends EnrollmentSession, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
  deleted: boolean
  deletedAt: Date
}

export interface EnrollmentSessionInterfaceModel extends Model<EnrollmentSessionInterface> {
}
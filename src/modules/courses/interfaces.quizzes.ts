import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

interface Quiz {
  question: string
  correctAnswerContext: string
  wrongAnswerContext: string
  choices: string[]
  correctAnswerIndex: number
  revisitChunk: string
  hint?: string
  block?: string
  lesson: string
  course: string
}

export interface CreateQuizPayload {
  question: string
  correctAnswerContext: string
  wrongAnswerContext: string
  choices: string[]
  correctAnswerIndex: number
  revisitChunk: string
  hint?: string
}

export interface QuizInterface extends Quiz, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}


export interface QuizInterfaceModel extends Model<QuizInterface> {
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<QuizInterface>>
}
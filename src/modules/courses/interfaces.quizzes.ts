import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

export enum QuestionTypes {
  OBJECTIVE = "objectives",
  SUBJECTIVE = "subjective",
  TRUE_FALSE = "true_false",
  YES_NO = "yes_no",
  POLARITY =  "agree_disagree",
}

interface Quiz {
  question: string
  questionType: QuestionTypes
  correctAnswerContext: string
  wrongAnswerContext: string
  choices: string[]
  correctAnswerIndex: number
  revisitChunk: string
  hint?: string
  block?: string
  lesson?: string
  assessment?: string
  course: string
}

export interface CreateQuizPayload {
  question: string
  questionType?: QuestionTypes
  block?: string
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
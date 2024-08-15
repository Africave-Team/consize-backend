import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

export enum QuestionGroupsTypes {
    ASSESSMENT = "assessment",
    PRE_ASSESSMENT = "pre-assessment",
    END_OF_BLOCK = "end-of-block",
    END_OF_LESSON = "end-of-lesson",
}

interface QuestionGroups {
  type: QuestionGroupsTypes
  position: string
  questions: string[]
}

export interface QuestionGroupsPayload {
  type: QuestionGroupsTypes
  position: string
  questions: string[]
}

export interface QuestionGroupsInterface extends QuestionGroups, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}


export interface QuestionGroupsInterfaceModel extends Model<QuestionGroupsInterface> {
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<QuestionGroupsInterface>>
}
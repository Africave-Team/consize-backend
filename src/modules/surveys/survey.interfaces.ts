import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'


export enum ResponseType {
  MULTI_CHOICE = "multi-choice",
  FREE_FORM = "free-form"
}

export interface Question {
  id: string
  question: string
  responseType: ResponseType
  choices: string[]
}

interface Survey {
  team: string
  title: string
  questions: Question[]
}

export interface CreateSurveyPayload {
  title: string
  questions: Question[]
}

export interface SurveyInterface extends Survey, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}


export interface SurveyInterfaceModel extends Model<SurveyInterface> {
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<SurveyInterface>>
}

export interface SurveyResponse {
  response: string
  responseType: ResponseType
  surveyQuestion: string
  student: string
  team: string
  survey: string
  course: string
}

export interface SurveyResponseInterface extends SurveyResponse, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface SurveyResponseInterfaceModel extends Model<SurveyResponseInterface> {
}

export interface ChartDataInformation {
  surveyId: string
  questionId: string
  questionText: string
  choices: string[]
  responses: { option: string, count: number, percent: number }[]
  totalCount: number
}

export interface ResponseMap {
  [option: string]: number
}


export interface AssessmentAggregationResult {
  _id: string             // ID of the assessment
  studentId: string       // ID of the student
  courseId: string        // ID of the course
  teamId: string          // ID of the team
  assessmentId: string    // ID of the assessment
  score: number           // The score of the assessment
  title: string
  studentDetails: {
    firstName: string     // First name of the student
    otherNames: string    // Other names of the student
  }
}

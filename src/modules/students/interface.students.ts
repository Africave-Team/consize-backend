import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

export interface Student {
  firstName: string
  otherNames: string
  phoneNumber: string
  email: string
}

export interface StudentInterface extends Student, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface StudentInterfaceModel extends Model<StudentInterface> {
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<StudentInterface>>
}
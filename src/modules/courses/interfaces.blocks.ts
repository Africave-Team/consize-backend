import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'
import { Media } from './interfaces.courses'


interface Block {
  title: string
  content: string
  quiz?: string
  bodyMedia?: Media
  lesson: string
  course: string
}

export interface CreateBlockPayload {
  title: string
  content: string
  quiz?: string 
  bodyMedia?: Media
}

export interface BlockInterface extends Block, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}


export interface BlockInterfaceModel extends Model<BlockInterface> {
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<BlockInterface>>
}
import { Document, Model } from 'mongoose'
import { StudentInterface } from './interface.students'

export interface OTP {
  student: string | StudentInterface
  code: string
  expiration: Date
}

export interface OTPInterface extends OTP, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}

export interface OTPInterfaceModel extends Model<OTPInterface> {
}
import mongoose, { Schema } from 'mongoose'
import { OTPInterface, OTPInterfaceModel } from './interface.otp'
import { v4 } from 'uuid'
import { toJSON } from '../toJSON'

const otpSchema = new Schema<OTPInterface>({
  _id: { type: String, default: () => v4() },
  student: {
    type: String,
    ref: "Students"
  },
  code: {
    type: String
  },
  expiration: {
    type: Date
  },
}, {
  collection: "otps"
})

otpSchema.plugin(toJSON)

const OTP = mongoose.model<OTPInterface, OTPInterfaceModel>('OTPs', otpSchema)

export default OTP
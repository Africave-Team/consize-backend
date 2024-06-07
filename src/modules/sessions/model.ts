
import mongoose, { Schema } from 'mongoose'
import { v4 } from 'uuid'
import { toJSON } from '../toJSON'
import { EnrollmentSessionInterface, EnrollmentSessionInterfaceModel } from './sessions.interface'

const enrollmentSchema = new Schema<EnrollmentSessionInterface, EnrollmentSessionInterfaceModel>({
  _id: { type: String, default: () => v4() },
  studentId: String,
  courseId: String,
  teamId: String,
  name: String,
  phoneNumber: String,
  progress: Number,
  completed: Boolean,
  droppedOut: Boolean,
  certificate: String,
  distribution: String,
  scores: [Number],
  lessons: Object
}, {
  collection: "enrollments",
  timestamps: false
})

enrollmentSchema.plugin(toJSON)

const Enrollments = mongoose.model<EnrollmentSessionInterface, EnrollmentSessionInterfaceModel>('Enrollments', enrollmentSchema)

export default Enrollments



import mongoose, { Schema } from 'mongoose'
import { v4 } from 'uuid'
import { toJSON } from '../toJSON'
import { AssessmentInterface, AssessmentInterfaceModel } from './assessment.interface'

const assessmentSchema = new Schema<AssessmentInterface, AssessmentInterfaceModel>({
  _id: { type: String, default: () => v4() },
  studentId: String,
  courseId: String,
  teamId: String,
  assessmentId: String,
  score: {
    type: Number,
    default: 0
  }

}, {
  collection: "assessments",
  timestamps: true
})

assessmentSchema.plugin(toJSON)

const Assessment = mongoose.model<AssessmentInterface, AssessmentInterfaceModel>('assessments', assessmentSchema)

export default Assessment


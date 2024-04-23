import { ResponseType, SurveyResponseInterface, SurveyResponseInterfaceModel } from './survey.interfaces'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"


const SurveyResponseSchema = new Schema<SurveyResponseInterface, SurveyResponseInterfaceModel>(
  {
    _id: { type: String, default: () => v4() },
    response: { type: String, required: true },
    team: {
      type: String,
      ref: "Teams"
    },
    responseType: { type: String, enum: Object.values(ResponseType), default: ResponseType.MULTI_CHOICE },
    course: {
      type: String,
      ref: "Courses"
    },
    survey: {
      type: String,
      ref: "Surveys"
    },
    surveyQuestion: {
      type: String
    },
    student: {
      type: String,
      ref: "Students"
    },
  },
  {
    collection: 'survey-response',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

const SurveyResponse = mongoose.model<SurveyResponseInterface, SurveyResponseInterfaceModel>('SurveyResponse', SurveyResponseSchema)

export default SurveyResponse

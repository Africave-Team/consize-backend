import { SurveyInterface, SurveyInterfaceModel, Question, ResponseType } from './survey.interfaces'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'

const QuestionSchema = new Schema<Question>(
  {
    id: { type: String, default: () => v4() },
    question: { type: String, required: true },
    responseType: { type: String, enum: Object.values(ResponseType), default: ResponseType.MULTI_CHOICE },
    choices: { type: [String], default: [] }
  },
  {
    timestamps: false,
    _id: false
  }
)

const SurveySchema = new Schema<SurveyInterface, SurveyInterfaceModel>(
  {
    _id: { type: String, default: () => v4() },
    title: { type: String, required: true },
    team: {
      type: String,
      ref: "Teams"
    },
    questions: {
      type: [QuestionSchema],
      default: []
    }
  },
  {
    collection: 'surveys',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

SurveySchema.plugin(toJSON)
SurveySchema.plugin(paginate)

const Surveys = mongoose.model<SurveyInterface, SurveyInterfaceModel>('Surveys', SurveySchema)

export default Surveys

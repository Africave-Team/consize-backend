import { QuestionGroupsInterface, QuestionGroupsInterfaceModel } from './interfaces.question-group'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'

const QuestionGroupSchema = new Schema<QuestionGroupsInterface, QuestionGroupsInterfaceModel>(
  {
    _id: { type: String, default: () => v4() },
    message: { type: String },
    title: { type: String },
    questions: {
      type: [String],
      default: [],
      ref: "Quizzes",
      required: true
    },
    course: {
      type: String,
      required: true
    }

  },
  {
    collection: 'question-group',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

QuestionGroupSchema.plugin(toJSON)
QuestionGroupSchema.plugin(paginate)

const QuestionGroup = mongoose.model<QuestionGroupsInterface, QuestionGroupsInterfaceModel>('QuestionGroups', QuestionGroupSchema)

export default QuestionGroup

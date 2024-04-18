import { QuizInterface, QuizInterfaceModel } from './interfaces.quizzes'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'

const QuizSchema = new Schema<QuizInterface, QuizInterfaceModel>(
  {
    _id: { type: String, default: () => v4() },
    question: {
      type: String,
      required: true
    },
    choices: {
      type: [String],
      required: true
    },
    correctAnswerIndex: {
      type: Number,
      required: true
    },
    correctAnswerContext: {
      type: String,
      required: true
    },
    wrongAnswerContext: {
      type: String
    },
    revisitChunk: {
      type: String,
    },
    hint: {
      type: String
    },
    lesson: {
      type: String,
      required: true,
      ref: "Lessons"
    },
    block: {
      type: String,
      ref: "Blocks"
    },
    course: {
      type: String,
      ref: "Courses",
      required: true
    }
  },
  {
    collection: 'quizzes',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

QuizSchema.plugin(toJSON)
QuizSchema.plugin(paginate)

const Quizzes = mongoose.model<QuizInterface, QuizInterfaceModel>('Quizzes', QuizSchema)

export default Quizzes

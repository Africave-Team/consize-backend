import { LessonInterface, LessonInterfaceModel } from './interfaces.lessons'
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'

const LessonSchema = new Schema<LessonInterface, LessonInterfaceModel>(
  {
    _id: { type: String, default: () => v4() },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    course: {
      type: String,
      ref: "Courses"
    },
    quizzes: {
      type: [String],
      ref: "Quizzes"
    },
    blocks: {
      type: [String],
      ref: "Blocks"
    }
  },
  {
    collection: 'lessons',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

LessonSchema.plugin(toJSON)
LessonSchema.plugin(paginate)

const Lessons = mongoose.model<LessonInterface, LessonInterfaceModel>('Lessons', LessonSchema)

export default Lessons

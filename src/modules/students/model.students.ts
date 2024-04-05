import mongoose, { Schema } from 'mongoose'
import { StudentInterface, StudentInterfaceModel } from './interface.students'
import { v4 } from 'uuid'
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'

const StudentSchema = new Schema<StudentInterface>({
  _id: { type: String, default: () => v4() },
  firstName: {
    type: String
  },
  otherNames: {
    type: String
  },
  phoneNumber: {
    type: String
  },
  email: {
    type: String
  },
  custom: {
    type: Object
  },
}, {
  collection: "students"
})

StudentSchema.index({ firstName: 1, otherNames: 1, phoneNumber: 1, email: 1 })
StudentSchema.plugin(toJSON)
StudentSchema.plugin(paginate)

const Students = mongoose.model<StudentInterface, StudentInterfaceModel>('Students', StudentSchema)

export default Students
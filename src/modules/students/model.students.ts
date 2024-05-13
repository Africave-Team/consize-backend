import mongoose, { Schema } from 'mongoose'
import { StudentInterface, StudentInterfaceModel } from './interface.students'
import { v4 } from 'uuid'
import { toJSON } from '../toJSON'
import { paginate } from '../paginate'
import { Cohorts } from '../cohorts'
import { agenda } from '../scheduler'
import { COHORT_SCHEDULE_STUDENT } from '../scheduler/MessageTypes'

const StudentSchema = new Schema<StudentInterface>({
  _id: { type: String, default: () => v4() },
  verified: {
    type: Boolean,
    default: false
  },
  rejected: {
    type: Boolean,
    default: false
  },
  firstName: {
    type: String
  },
  otherNames: {
    type: String
  },
  tz: {
    type: String
  },
  phoneNumber: {
    type: String
  },
  channelId: {
    type: String
  },
  slackId: {
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

StudentSchema.index({ firstName: 1, otherNames: 1, phoneNumber: 1, slackId: 1, email: 1 })
StudentSchema.plugin(toJSON)
StudentSchema.plugin(paginate)

const Students = mongoose.model<StudentInterface, StudentInterfaceModel>('Students', StudentSchema)



Students.watch().
  on('change', async (data: {
    operationType: string,
    documentKey: { _id: string },
    updateDescription?: {
      updatedFields: {
        verified: boolean
      }
    }
  }) => {
    if (data.updateDescription && data.updateDescription.updatedFields && data.updateDescription.updatedFields.verified) {
      let studentId = data.documentKey._id.toString()
      // get all cohorts for this course whose status is still pending
      const student = await Students.findById(studentId)
      if (student) {
        // get all cohorts that this user belongs to
        const cohorts = await Cohorts.find({ members: { $in: [studentId] } })
        for (let cohort of cohorts) {
          agenda.schedule<{ cohortId: string, studentId: string }>("in 10 seconds", COHORT_SCHEDULE_STUDENT, { cohortId: cohort.id, studentId })
        }
      }
    }
  })


export default Students
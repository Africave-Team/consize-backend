
import mongoose, { Schema } from 'mongoose'
import { v4 } from "uuid"
import { toJSON } from '../toJSON'
import { CourseMaterial, CourseMetadata, CourseSettingsInterface, CourseSettingsInterfaceModel, DropoutEvents, EnrollmentField, LearnerGroup, LearnerGroupLaunchTime, Period, PeriodTypes } from './interfaces.settings'

const EnrollFieldSchema = new Schema<EnrollmentField>({
  id: { type: String, default: () => v4() },
  fieldName: {
    type: String
  },
  variableName: {
    type: String
  },
  defaultField: {
    type: Boolean
  },
  required: {
    type: Boolean
  },
  position: {
    type: Number
  },
}, {
  _id: false,
  timestamps: false
})


const PeriodSchema = new Schema<Period>({
  value: {
    type: Number
  },
  type: {
    type: String,
    enum: Object.values(PeriodTypes)
  }
}, {
  _id: false,
  timestamps: false
})

const MetadataSchema = new Schema<CourseMetadata>({
  idealLessonTime: {
    type: PeriodSchema
  },
  courseCompletionDays: {
    type: Number
  },
  maxEnrollments: {
    type: Number
  },
  maxLessonsPerDay: {
    type: Number
  },
  minLessonsPerDay: {
    type: Number
  },
}, {
  _id: false,
  timestamps: false
})

const LaunchTimeSchema = new Schema<LearnerGroupLaunchTime>({
  launchTime: {
    type: Date
  },
  utcOffset: {
    type: Number
  }
}, {
  _id: false,
  timestamps: false
})
const LearnerGroupSchema = new Schema<LearnerGroup>({
  id: { type: String, default: () => v4() },
  name: {
    type: String
  },
  members: {
    type: [String],
    ref: "Students"
  },
  launchTimes: {
    type: LaunchTimeSchema
  },
}, {
  _id: false,
  timestamps: false
})

const CourseMaterialSchema = new Schema<CourseMaterial>({
  id: { type: String, default: () => v4() },
  fileName: {
    type: String
  },
  fileSize: {
    type: String
  },
  fileType: {
    type: String
  },
  fileUrl: {
    type: String
  },
}, {
  _id: false,
  timestamps: false
})



const SettingSchema = new Schema<CourseSettingsInterface, CourseSettingsInterfaceModel>(
  {
    _id: { type: String, default: () => v4() },
    enrollmentFormFields: {
      type: [EnrollFieldSchema]
    },
    metadata: {
      type: MetadataSchema
    },
    learnerGroups: {
      type: [LearnerGroupSchema]
    },
    courseMaterials: {
      type: [CourseMaterialSchema]
    },
    reminderSchedule: {
      type: [String]
    },
    dropoutWaitPeriod: {
      type: PeriodSchema
    },
    reminderDuration: {
      type: PeriodSchema
    },
    inactivityPeriod: {
      type: PeriodSchema
    },
    dropoutEvent: {
      type: String,
      enum: Object.values(DropoutEvents)
    },

  },
  {
    collection: 'settings',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

SettingSchema.plugin(toJSON)

const Settings = mongoose.model<CourseSettingsInterface, CourseSettingsInterfaceModel>('Settings', SettingSchema)

export default Settings

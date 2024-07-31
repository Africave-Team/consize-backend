import { Document, Model } from 'mongoose'
import { Student } from '../students/interface.students'

export interface EnrollmentField {
  fieldName: string
  variableName: string
  required: boolean
  defaultField: boolean
  dataType: "text" | "number" | "boolean"
  id: string
  position: number
}

export interface CourseMetadata {
  idealLessonTime: Period
  courseCompletionDays: number
  maxLessonsPerDay: number
  minLessonsPerDay: number
  maxEnrollments: number
}

export interface LearnerGroup extends Document {
  name: string
  id: string
  members: string[]
  launchTimes: LearnerGroupLaunchTime | null
}

export interface LearnerGroupMembers {
  name: string
  id: string
  members: Student[]
  launchTimes: LearnerGroupLaunchTime | null
}

export interface LearnerGroupLaunchTime {
  launchTime: Date
  utcOffset: number
}

export interface CourseMaterial extends Document {
  id: string
  fileName: string
  fileUrl: string
  fileSize: string
  fileType: string
}

export enum DropoutEvents {
  LESSON_COMPLETION = "lesson completion date",
  INACTIVITY = "inactivity"
}

export enum PeriodTypes {
  DAYS = "days",
  HOURS = "hours",
  MINUTES = "minutes"
}
export interface Period {
  value: number
  type: PeriodTypes
}

export interface CourseResumptionSettings {
  enableImmediate: boolean
  enabledDateTimeSetup: boolean
  days: number
  time: string
}

export interface CourseDisableDays {
  saturday?: boolean
  sunday?: boolean
}


export interface CourseSettings {
  enrollmentFormFields: EnrollmentField[]
  metadata: CourseMetadata
  learnerGroups: LearnerGroup[]
  courseMaterials: CourseMaterial[]
  // times within the day to send out reminders
  reminderSchedule: string[]
  // how much inactivity time to wait for before sending dropout message
  dropoutWaitPeriod: Period
  // How long should the reminder (dropout message) continue for if the learner doesn’t respond?
  reminderDuration: Period
  // How many hours of learner inactivity before the next reminder (to continue) gets sent out?
  inactivityPeriod: Period
  dropoutEvent: DropoutEvents
  resumption: CourseResumptionSettings
  disableReminders?: CourseDisableDays

}

export interface CourseSettingsInterface extends CourseSettings, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}


export interface CourseSettingsInterfaceModel extends Model<CourseSettingsInterface> {

}

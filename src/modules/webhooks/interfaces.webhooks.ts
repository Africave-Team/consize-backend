import { MediaType } from '../courses/interfaces.courses'
import { Period } from '../courses/interfaces.settings'
import { SendSlackModalPayload } from '../slack/interfaces.slack'

interface Header {
  type: MediaType
  video?: {
    link: string
  },
  image?: {
    link: string
  },
  text?: string
}

interface MessageBody {
  text: string
}

export interface ReplyButton {
  type: "reply" | "web_url"
  reply?: {
    id: string
    title: string
  },
  url?: string,
  title?: string
}

export interface InteractiveMessageSectionRow {
  id: string,
  title: string
  description: string
}

interface InteractiveMessageSection {
  title: string
  rows: InteractiveMessageSectionRow[]
}

export interface InteractiveMessage {
  type: "interactive"
  interactive: {
    type: "button" | "list" | "cta_url"
    header?: Header
    body: MessageBody
    action: {
      buttons?: ReplyButton[]
      button?: string
      sections?: InteractiveMessageSection[]
      name?: string
      parameters?: any
    }
  }
}

interface Template {
  language: {
    code: string
  }
  name: string
  components?: Component[]
}

interface Component {
  type: string
  sub_type?: string
  index?: number
  parameters: Parameter[]
}

interface Parameter {
  type: string
  text: string
}

export interface Message {
  messaging_product: string
  recipient_type: string
  to: string
  type: "interactive" | "text" | "template" | "image" | "video" | "audio"
  interactive?: InteractiveMessage["interactive"]
  text?: {
    body: string
  },
  video?: {
    link: string
  },
  image?: {
    link: string
  },
  audio?: {
    link: string
  },
  template?: Template
  team?: string
}

export interface CourseEnrollment {
  team: string
  student: string
  id: string
  tz: string
  title: string
  description: string
  lastMessageId: string
  active: boolean
  progress: number
  currentBlock: number
  nextBlock: number
  totalBlocks: number
  maxLessonsPerDay: number
  minLessonsPerDay: number
  dailyLessonsCount: number
  owedLessonsCount: number
  quizAttempts: number
  lastActivity?: string
  lastLessonCompleted?: string
  finishedLastLessonAt?: number | null
  inactivityPeriod?: Period | undefined
  reminderDaysCount?: number
  slackResponseUrl?: string
  slackToken?: string
  blockStartTime?: string | null
  bundle?: boolean
  completed?: boolean
  assessmentId?: string
  assessmentScore?: number
  courses?: {
    key: string
    status: "completed" | "pending" | "progress"
  }[]
  lessons?: {
    [id: string]: {
      scores: number[]
    }
  },
  surveyData?: SendSlackModalPayload
}


export const CONTINUE = "ac5f75ff-3db0-4e5b-a071-55908e8c0d2e"
export const QUIZ_YES = "5176a99b-3ceb-4d1d-9758-020e8c82fb6a"
export const QUIZ_NO = "f36d317d-ec1c-42a4-b09f-1978d6c8f7c5"
export const QUIZ_A = "1024f5a2-9ed7-4a1f-bd66-9e4ee755ea51"
export const QUIZ_B = "c8a50741-b333-4447-b057-89f41779d8a5"
export const QUIZ_C = "9e72aee7-ffcd-407a-b198-9b12758ce903"
export const QUIZA_A = "1024f5a2-9ed7-5a1f-bd66-9e4ee755ea51"
export const QUIZA_B = "c8a50741-b333-5447-b057-89f41779d8a5"
export const QUIZA_C = "9e72aee7-ffcd-507a-b198-9b12758ce903"
export const START = "/start"
export const STATS = "/stats"
export const CERTIFICATES = "/certificates"
export const COURSES = "/courses"
export const TOMORROW = "/tomorrow"
export const SCHEDULE_RESUMPTION = "/schedule-resumption"

export const SURVEY_A = "/survey_a"
export const SURVEY_B = "/survey_b"
export const SURVEY_C = "/survey_c"

export const FREEFORM_RESPONSE = "/freeform-response"


export const MORNING = TOMORROW + '_9am'
export const AFTERNOON = TOMORROW + '_3pm'
export const EVENING = TOMORROW + '_8pm'

export const RESUME_COURSE = "RESUME_COURSE"
export const RESUME_COURSE_TOMORROW = "RESUME_COURSE_TOMORROW"


// slack
export const ACCEPT_INVITATION = "accept_invitation"
export const REJECT_INVITATION = "reject_invitation"

//help
export const HELP = "HELP"


export interface DailyReminderNotificationPayload {
  courseId: string,
  studentId: string,
  settingsId: string,
  distribution: string,
  ownerId: string
  last: boolean
}
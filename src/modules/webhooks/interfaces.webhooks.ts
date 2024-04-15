import { MediaType } from '../courses/interfaces.courses'

interface Header {
  type: MediaType
  video?: {
    link: string
  },
  image?: {
    link: string
  }
}

interface MessageBody {
  text: string
}

export interface ReplyButton {
  type: "reply"
  reply: {
    id: string
    title: string
  }
}

interface InteractiveMessage {
  type: "interactive"
  interactive: {
    type: "button"
    header?: Header
    body: MessageBody
    action: {
      buttons: ReplyButton[]
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
  type: "interactive" | "text" | "template"
  interactive?: InteractiveMessage["interactive"]
  text?: {
    body: string
  },
  template?: Template
}

export interface CourseEnrollment {
  team: string
  student: string
  id: string
  title: string
  description: string
  lastMessageId: string
  active: boolean
  progress: number
  currentBlock: number
  nextBlock: number
  totalBlocks: number
  quizAttempts: number
  blockStartTime?: Date | null
  lessons?: {
    [id: string]: {
      scores: number[]
    }
  }
}


export const CONTINUE = "ac5f75ff-3db0-4e5b-a071-55908e8c0d2e"
export const QUIZ_YES = "5176a99b-3ceb-4d1d-9758-020e8c82fb6a"
export const QUIZ_NO = "f36d317d-ec1c-42a4-b09f-1978d6c8f7c5"
export const QUIZ_A = "1024f5a2-9ed7-4a1f-bd66-9e4ee755ea51"
export const QUIZ_B = "c8a50741-b333-4447-b057-89f41779d8a5"
export const QUIZ_C = "9e72aee7-ffcd-407a-b198-9b12758ce903"
export const START = "/start"
export const STATS = "/stats"
export const CERTIFICATES = "/certificates"
export const COURSES = "/courses"
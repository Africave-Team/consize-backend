export interface JobData {
  title: string
  start: string | null
  end: string | null
  error: string | null
  result: Curriculum
  lessonCount: number
  status: "RUNNING" | "FINISHED" | "FAILED" | "RETRYING"
}


interface LessonSection {
  [sectionKey: string]: [string, string]
}

interface Lesson {
  lesson_name: string
  sections: LessonSection
}

interface Lessons {
  [lessonKey: string]: Lesson
}

export interface Curriculum {
  description: string
  lessons: Lessons
}

export interface BuildSectionPayload {
  jobId: string
  seedTitle: string,
  seedContent: string,
  lessonId: string,
  lessonName: string
  title: string
  courseId: string
}


export interface BuildSectionFromFilePayload {
  jobId: string
  assistantId: string
  seedTitle: string,
  seedContent: string,
  lessonId: string,
  lessonName: string
  title: string
  courseId: string
  last: boolean
  storeId: string
}



export interface BuildSectionsFromFilePayload {
  jobId: string
  assistantId: string
  sections: {
    seedTitle: string,
    seedContent: string,
  }[]
  lessonIndex: string
  lessonId: string,
  lessonName: string
  title: string
  courseId: string
  last: boolean
  storeId: string
}

export interface SectionResultAI {
  id: string
  sectionName: string
  sectionContent: string
  followupQuiz: QuizAI
  sectionQuiz: QuizAI
}

export interface QuizAI {
  id: string
  question: string
  options: string[]
  correct_answer: string
  hint: string
  explanation: string
}
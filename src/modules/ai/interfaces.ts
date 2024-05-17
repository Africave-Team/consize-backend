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

interface Curriculum {
  description: string
  lessons: Lessons
}
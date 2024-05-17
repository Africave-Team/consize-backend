export const generateOutlinePrompt = (title: string, count: number = 5): string => {
  let random = Number((Math.random() * (7 - 4) + 4).toFixed(0))
  let prompt = `I want to create a course on ${title}. It shall have ${count} lessons. I want you to provide the lesson names and a course description for the course in json format. Provide the course description in 3 - 5 sentences. Also provide a list of ${random} sections for each lesson, and the overview of the section in 2 - 4 sentences

  Use the following format - 
  
  {
    "description": "< course description >",
    "lessons": {
      Lesson 1: {
          lesson_name: "< name of lesson 1 >",
          sections : {
                section1 : [ "<topic of the section>" , "<overview of the section>"],
                section2 : [ "<topic of the section>" , "<overview of the section>"],
                and so on
              }
          },
     Lesson 2: {
          lesson_name: "< name of lesson 2>",
          sections : {
                section1 : [ "<topic of the section>" , "<overview of the section>"],
                section2 : [ "<topic of the section>" , "<overview of the section>"],
                and so on
              }
          },
      .......and so on
    }
  }`
  return prompt
}
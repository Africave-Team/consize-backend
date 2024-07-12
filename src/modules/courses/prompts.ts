export const generateOutlinePrompt = (title: string, count: number = 5): string => {
  let random = Number((Math.random() * (7 - 4) + 4).toFixed(0))
  let lessons = ``
  for (let index = 0; index < count; index++) {
    lessons += `Lesson ${index + 1}: {
          lesson_name: "< name of lesson ${index + 1} >",
          sections : {
                section1 : [ "<topic of the section>" , "<overview of the section>"],
                section2 : [ "<topic of the section>" , "<overview of the section>"],
                section3 : [ "<topic of the section>" , "<overview of the section>"],
                section4 : [ "<topic of the section>" , "<overview of the section>"],
                section5 : [ "<topic of the section>" , "<overview of the section>"],
              }
          },`
  }
  let prompt = `I want to create a course on ${title}. It shall have ${count} lessons. I want you to provide the lesson names and a course description for the course in JSON format. Provide the course description in 3 - 5 sentences. Also provide a list of ${random} sections for each lesson, and the overview of the section in 2 - 4 sentences

  Use the following format - 
  
  {
    "description": "< course description >",
    "lessons": {
      ${lessons}
    }
  }`
  return prompt
}

export const generateOutlinePromptDocument = (title: string): string => {
  // let random = Number((Math.random() * (7 - 4) + 4).toFixed(0))
  let prompt = `
Based on the file attached to this assistant, I want you to do the following. Ignore adding citations and annotations.
I want you to create a course on ${title}. Based on the documents provided, create exactly 5 lessons. Provide the lesson names and a course description for the course in JSON format. Provide the course description in 3 - 5 sentences. Also, provide a list of 5 sections for each lesson, and an overview of each section in 2 - 4 sentences.

Use the following format:

{
  "description": "<course description>",
  "lessons": {
    "Lesson 1": {
      "lesson_name": "<name of lesson 1>",
      "sections": {
        "section1": ["<topic of the section>", "<overview of the section>"],
        "section2": ["<topic of the section>", "<overview of the section>"],
        "section3": ["<topic of the section>", "<overview of the section>"],
        "section4": ["<topic of the section>", "<overview of the section>"],
        "section5": ["<topic of the section>", "<overview of the section>"]
      }
    },
    "Lesson 2": {
      "lesson_name": "<name of lesson 2>",
      "sections": {
        "section1": ["<topic of the section>", "<overview of the section>"],
        "section2": ["<topic of the section>", "<overview of the section>"],
        "section3": ["<topic of the section>", "<overview of the section>"],
        "section4": ["<topic of the section>", "<overview of the section>"],
        "section5": ["<topic of the section>", "<overview of the section>"]
      }
    },
    "Lesson 3": {
      "lesson_name": "<name of lesson 3>",
      "sections": {
        "section1": ["<topic of the section>", "<overview of the section>"],
        "section2": ["<topic of the section>", "<overview of the section>"],
        "section3": ["<topic of the section>", "<overview of the section>"],
        "section4": ["<topic of the section>", "<overview of the section>"],
        "section5": ["<topic of the section>", "<overview of the section>"]
      }
    },
    "Lesson 4": {
      "lesson_name": "<name of lesson 4>",
      "sections": {
        "section1": ["<topic of the section>", "<overview of the section>"],
        "section2": ["<topic of the section>", "<overview of the section>"],
        "section3": ["<topic of the section>", "<overview of the section>"],
        "section4": ["<topic of the section>", "<overview of the section>"],
        "section5": ["<topic of the section>", "<overview of the section>"]
      }
    },
    "Lesson 5": {
      "lesson_name": "<name of lesson 5>",
      "sections": {
        "section1": ["<topic of the section>", "<overview of the section>"],
        "section2": ["<topic of the section>", "<overview of the section>"],
        "section3": ["<topic of the section>", "<overview of the section>"],
        "section4": ["<topic of the section>", "<overview of the section>"],
        "section5": ["<topic of the section>", "<overview of the section>"]
      }
    }
  }
}
`
  return prompt
}

export const generateSectionPrompt = (title: string, lessonName: string, seedTitle: string, seedContent: string): string => {

  return `I am creating a course on "${title}". It has several lessons and each lesson has some sections. I shall give you the name of a lesson, one of its section topic and the section overview, and i want you to create the content for that specific section in JSON format. 

  The section content size shall be 150 words. Start the first sentence with an appropriate emoji. Add a \n character after every 3 sentences. Follow every \n character with another appropriate emoji.
  
  Here is the lesson name - "${lessonName}"
  Here is the section topic - "${seedTitle}"
  Here is the section overview - "${seedContent}"
  
  Use the following format for your response - 
  
  {
    "sectionName" : "< name of the section >",
    "sectionContent" : "< content for the section >"
  }`
}

export const generateSectionFilePrompt = (title: string, lessonName: string, seedTitle: string, seedContent: string): string => {

  return `I am creating a course on "${title}".  It has several lessons and each lesson has some sections. I shall give you the name of a lesson, one of its section topic and the section overview, and i want you to create the content for that specific section from the attached vector store, in JSON format. 
  I need you to also create 1 question. The question shall have a "yes" or "no" option, and also provide the correct answer and an explanation as to why that is the correct answer
  Plus 1 multiple choice question. The question shall have 3 options, and also provide the correct answer, a hint to what the correct answer is and an explanation as to why that is the correct answer.
  The section content size shall be 150 words. Start the first sentence with an appropriate emoji. Add a \n character after every 3 sentences. Follow every \n character with another appropriate emoji.
  
  Here is the lesson name - "${lessonName}"
  Here is the section topic - "${seedTitle}"
  Here is the section overview - "${seedContent}"
  
  Use the following format for your response - 
  {
    followupQuiz: {
      "question": "< the question >",
      "options": [
        "Yes", "No"
      ],
      "correct_answer": "< either yes or no >",
      "explanation": "Explanation for the correct answer"
    },
    sectionQuiz: {
      "question": "< the question >",
      "options": [
        "< option 1 >", "< option 2 >", "< option 3 >"
      ],
      "correct_answer": "< index of the correct option>",
      "explanation": "Explanation for the correct answer"
      "hint": "A hint to the correct answer"
    }
    "sectionName" : "< name of the section >",
    "sectionContent" : "< content for the section >"
  }`
}

export const generateSectionsFilePrompt = (title: string, lessonName: string, sections: { seedTitle: string, seedContent: string }[]): string => {

  return `I am creating a course on "${title}".  It has several lessons and each lesson has some sections. I shall give you the names of all the lessons, its sections' topic and the sections' overview, and i want you to create the content for each specific section from the attached vector store, in JSON format. 
  You MUST CREATE 1 followup question about that section. The question shall have a "yes" or "no" option, and also provide the correct answer and an explanation as to why that is the correct answer
  You MUST CREATE 1 multiple choice question about that section with 3 options, and also provide the correct answer, a hint to what the correct answer is and an explanation as to why that is the correct answer.
  Each section content MUST BE 150 words MINIMUM. Start the first sentence with an appropriate emoji. Add a \n character after every 3 sentences. Follow every \n character with another appropriate emoji.
  
  Here is the lesson name - "${lessonName}"
  Below are the lesson sections
  ${sections.map(({ seedContent, seedTitle }, i) => `
    section ${i + 1} topic - "${seedTitle}"
    section ${i + 1} overview - "${seedContent}"
  `)}
  
  Use the following format for your response - 
  {
    section 1: {
    followupQuiz: {
      "question": "< the question >",
      "options": [
        "Yes", "No"
      ],
      "correct_answer": "< either yes or no >",
      "explanation": "Explanation for the correct answer"
    },
    sectionQuiz: {
      "question": "< the question >",
      "options": [
        "< option 1 >", "< option 2 >", "< option 3 >"
      ],
      "correct_answer": "< index of the correct option>",
      "explanation": "Explanation for the correct answer"
      "hint": "A hint to the correct answer"
    }
    "sectionName" : "< name of the section >",
    "sectionContent" : "< content for the section >"
  },
  section 2: {
    followupQuiz: {
      "question": "< the question >",
      "options": [
        "Yes", "No"
      ],
      "correct_answer": "< either yes or no >",
      "explanation": "Explanation for the correct answer"
    },
    sectionQuiz: {
      "question": "< the question >",
      "options": [
        "< option 1 >", "< option 2 >", "< option 3 >"
      ],
      "correct_answer": "< index of the correct option>",
      "explanation": "Explanation for the correct answer"
      "hint": "A hint to the correct answer"
    }
    "sectionName" : "< name of the section >",
    "sectionContent" : "< content for the section >"
  },
  section 3: {
    followupQuiz: {
      "question": "< the question >",
      "options": [
        "Yes", "No"
      ],
      "correct_answer": "< either yes or no >",
      "explanation": "Explanation for the correct answer"
    },
    sectionQuiz: {
      "question": "< the question >",
      "options": [
        "< option 1 >", "< option 2 >", "< option 3 >"
      ],
      "correct_answer": "< index of the correct option>",
      "explanation": "Explanation for the correct answer"
      "hint": "A hint to the correct answer"
    }
    "sectionName" : "< name of the section >",
    "sectionContent" : "< content for the section >"
  },
  section 4: {
    followupQuiz: {
      "question": "< the question >",
      "options": [
        "Yes", "No"
      ],
      "correct_answer": "< either yes or no >",
      "explanation": "Explanation for the correct answer"
    },
    sectionQuiz: {
      "question": "< the question >",
      "options": [
        "< option 1 >", "< option 2 >", "< option 3 >"
      ],
      "correct_answer": "< index of the correct option>",
      "explanation": "Explanation for the correct answer"
      "hint": "A hint to the correct answer"
    }
    "sectionName" : "< name of the section >",
    "sectionContent" : "< content for the section >"
  },
  section 5: {
    followupQuiz: {
      "question": "< the question >",
      "options": [
        "Yes", "No"
      ],
      "correct_answer": "< either yes or no >",
      "explanation": "Explanation for the correct answer"
    },
    sectionQuiz: {
      "question": "< the question >",
      "options": [
        "< option 1 >", "< option 2 >", "< option 3 >"
      ],
      "correct_answer": "< index of the correct option>",
      "explanation": "Explanation for the correct answer"
      "hint": "A hint to the correct answer"
    }
    "sectionName" : "< name of the section >",
    "sectionContent" : "< content for the section >"
  },
  ...and so on
  }`
}

export const generateSectionNoSeedPrompt = (title: string, lessonName: string, seedTitle: string): string => {

  return `I am creating a course on "${title}". It has several lessons and each lesson has some sections. I shall give you the name of a lesson, one of its section topic, and i want you to create the content for that specific section in JSON format. 

  The section content size shall be 150 words. Start the first sentence with an appropriate emoji. Add a \n character after every 3 sentences. Follow every \n character with another appropriate emoji.
  
  Here is the lesson name - "${lessonName}"
  Here is the section topic - "${seedTitle}"
  
  Use the following format for your response - 
  
  {
    "sectionName" : "< name of the section >",
    "sectionContent" : "< content for the section >"
  }`
}

export const generateFollowupQuestionPrompt = (section: string): string => {
  return `I have a small content piece from a micro learning course and i need you to create 1 question. The question shall have a "yes" or "no" option, and also provide the correct answer and an explanation as to why that is the correct answer.


  Provide your response in the following JSON format
  
  {
    "questions": [
      {
        "question": "< the question >",
        "options": [
          "Yes", "No"
        ],
        "correct_answer": "< either yes or no >",
        "explanation": "Explanation for the correct answer"
      }
    
    ]
  }
  
  Here is the content - 
  
  ${section}`
}

export const generateQuizPrompt = (section: string): string => {
  return `
  I have a small content piece from a micro learning course and i need you to create 1 multiple choice question. The question shall have 3 options, and also provide the correct answer, a hint to what the correct answer is and an explanation as to why that is the correct answer.
  
  
  Provide your response in the following format
  
  
  {
    "questions": [
      {
        "question": "< the question >",
        "options": [
          "< option 1 >", "< option 2 >", "< option 3 >"
        ],
        "correct_answer": "< index of the correct option>",
        "explanation": "Explanation for the correct answer"
        "hint": "A hint to the correct answer"
      }
    
    ]
  }
  
  Here is the content - 
  
  ${section}`
}
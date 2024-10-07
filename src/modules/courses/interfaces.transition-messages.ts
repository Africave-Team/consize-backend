import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'


interface TransitionMessages {
  type: string
  message: string
  course: string
}


export interface TransitionMessagesInterface extends TransitionMessages, Document {
  _id: string
  createdAt?: Date
  updatedAt?: Date
}


export interface  TransitionMessageInterfaceModel extends Model<TransitionMessagesInterface> {
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<TransitionMessagesInterface>>
}

export const transitionMessages = {
  "Successful Enrollment": {
    "variables": ["course.title", "courseOwner?.name"], 
    "description": "Sent when the user enrolls successfully in a course.",
    "content": "`You have successfully enrolled for the course *${course.title}* by the organization *${courseOwner?.name}*.\n\nThis is a self paced course, which means you can learn at your own speed.\n\nStart the course anytime at your convenience by tapping 'Start'.`"
  },
  "In-Course Assessment Completion": {
    "variables": [], 
    "description": "Sent after completing an assessment in the course to prompt the user to continue the course.",
    "content": "Congratulations on finishing the assessment 🥳!\n Click continue to continue with the rest of the course."
  },
  "Final Assessment Completion": {
    "variables": [], 
    "description": "Sent after completing the last assessment to move forward.",
    "content": "Congratulations on finishing the assessment 🥳!\n Click continue to move forward"
  },
  "Start of End-of-Lesson Quiz": {
    "variables": [], 
    "description": "Sent to introduce the quiz after completing a lesson.",
    "content": `Congratulations 👏\nWe are done with the lesson 🙌. \nIt’s time to answer a few questions and test your understanding with a short quiz 🧠`
  },
  "Completion of End of Lesson Quiz": {
    "variables": ["score","course_rank","progress"], 
    "description": "Sent after completing a lesson quiz to show results and progress.",
    "content": `Congratulations on finishing the quiz 🥳! Let’s see how well you did 🌚\n\nYou scored: {score}% in this lesson 🏆\nYou are currently ranked #{course_rank} in this course 🏅\nYour course progress: {progress}% ⏱\n\nIn a few seconds, you will see a leaderboard showing the top performers in this course.`
  },
  "Lesson Transition": {
    "variables": ["updatedData.dailyLessonsCount","updatedData.maxLessonsPerDay"], 
    "description": "Sent when moving from one lesson to the next, offering scheduling options.",
    "content": "`\nCongratulations! 🎉 You've reached today's learning target!\nLessons completed today:  ${updatedData.dailyLessonsCount} \nMaximum daily lessons ${updatedData.maxLessonsPerDay}\nYou can still complete ${updatedData.maxLessonsPerDay - updatedData.dailyLessonsCount} lessons today`"
  },
  "Resumption Time Selection": {
    "variables": [], 
    "description": "Sent when the user selects a time to resume the course.",
    "content": `Next lesson: Overcoming Procrastination\n
Tap 'Continue Tomorrow' to continue tomorrow at 9am tomorrow \n

Tap 'Set Resumption Time' to choose the time to continue tomorrow.\n
            
Great job! 🥳 You've reached the maximum lesson target for today.\n
Go over what you've learnt today and come back tomorrow for more 😉`
  },
  "Scheduled Resumption Confirmed": {
    "variables": [], 
    "description": "Confirmation message for a scheduled course resumption.",
    "content": `You have chosen to resume this course tomorrow.\n
Select a time tomorrow to resume this course.\nMorning: Resume at 9am tomorrow \n Afternoon: Resume at 3pm tomorrow \n
Evening: Resume at 8pm tomorrow`
  },
  "Scheduled Resumption Reminder": {
    "variables": [], 
    "description": "Sent to remind the user of their scheduled resumption time.",
    "content": `You have chosen to resume this course at 9:00am tomorrow.\n We will continue this course for you at this time.`
  },
  "Scheduled Course Resumption": {
    "variables": [], 
    "description": "Sent when the user’s scheduled course resumption time has been reached, inviting them to continue the course.",
    "content": `Welcome back\n
You scheduled to resume the course Time Management today at this time.

You can resume your scheduled course by clicking the "Resume Now" button below`
  },
  "Course Completion (Survey)": {
    "variables": [], 
    "description": "Sent after completing the last lesson to prompt the user to provide feedback via a survey.",
    "content": `That was the last lesson 🎊\n Well done on finishing the course 🤝\n You’ll be getting your certificate 📄 soon so that you can brag about it😎 but first, we want to get your feedback on the course.\n We’ll be sending you a quick survey next 🔎`
  },
  "Survey Completion": {
    "variables": [], 
    "description": "Sent after completing the course survey.",
    "content": `That was the last survey question 🎊\n
Thank you for your feedback about this course 🤝.`
  },
  "3-min Inactivity Reminder": {
    "variables": ["student.firstName", "course.title"], 
    "description": "Sent after a period of inactivity in the course to encourage the user to continue.",
    "content": "`Hey ${student.firstName}! It looks like you have been inactive in the course *${course.title}* 🤔.\n\nIn case you are stuck due to technical reasons, please click 'Continue' to resume the course.`"
  },
  "Inactivity Reminder": {
    "variables": ["student.firstName"], 
    "description": "Sent after a longer period of inactivity, encouraging the user to stay on track.",
    "content": "`Hey ${student.firstName}! It looks like you have been idle for quite some time 🤔.\n\nOther learners are getting ahead.\n Click 'Continue' to move forward in the course.\n If you face any issues while taking the course, respond with a ‘help’ to talk to our support team`"
  },
  "Scheduled Reminder": {
    "variables": ["student.firstName", "enrollment.nextBlock","enrollment.totalBlocks", "enrollment.title"], 
    "description": "Sent to remind the user of their course progress and prompt continuation.",
    "content": "`Hey ${student.firstName}! You have made ${((enrollment.nextBlock / enrollment.totalBlocks) * 100).toFixed(0)}% progress in the course ${enrollment.title}.🎉\n\nContinue now to learn more from the course 🎯.`"
  },
  "Dropout": {
    "variables": [], 
    "description": "",
    "content": ""
  }
};
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
    "description": "Sent when the user enrolls successfully in a course.",
    "content": `Hello! Your course enrollment is successful! Congratulations 🎊

This is a self-paced course, so you can learn at your own speed.

Start the course below by clicking "Begin Now"

All the best! 👏`
  },
  "In-Course Assessment Completion": {
    "description": "Sent after completing an assessment in the course to prompt the user to continue the course.",
    "content": "Congratulations on finishing the assessment 🥳! Click continue to continue with the rest of the course."
  },
  "Final Assessment Completion": {
    "description": "Sent after completing the last assessment to move forward.",
    "content": "Congratulations on finishing the assessment 🥳! Click continue to move forward"
  },
  "Start of End-of-Lesson Quiz": {
    "description": "Sent to introduce the quiz after completing a lesson.",
    "content": `Congratulations 👏

We are done with the lesson 🙌. 

It’s time to answer a few questions and test your understanding with a short quiz 🧠`
  },
  "Completion of End of Lesson Quiz": {
    "description": "Sent after completing a lesson quiz to show results and progress.",
    "content": `Congratulations on finishing the quiz 🥳! Let’s see how well you did 🌚

You scored: 50% in this lesson 🏆
You are currently ranked #1 in this course 🏅
Your course progress: 36% ⏱

In a few seconds, you will see a leaderboard showing the top performers in this course.`
  },
  "Lesson Transition": {
    "description": "Sent when moving from one lesson to the next, offering scheduling options.",
    "content": `➡️ Tap 'Continue Now' when you're ready to start.

Tap 'Continue Tomorrow' to continue tomorrow at 9am tomorrow 

Tap 'Set Resumption Time' to choose the time to continue tomorrow.
            
Congratulations! 🎉 You've reached today's learning target!
Lessons completed today:  1 
Maximum daily lessons 4
You can still complete 3 lessons today`
  },
  "Resumption Time Selection": {
    "description": "Sent when the user selects a time to resume the course.",
    "content": `Next lesson: Overcoming Procrastination
Tap 'Continue Tomorrow' to continue tomorrow at 9am tomorrow 

Tap 'Set Resumption Time' to choose the time to continue tomorrow.
            
Great job! 🥳 You've reached the maximum lesson target for today.
Go over what you've learnt today and come back tomorrow for more 😉`
  },
  "Scheduled Resumption Confirmed": {
    "description": "Confirmation message for a scheduled course resumption.",
    "content": `You have chosen to resume this course tomorrow. 

Select a time tomorrow to resume this course.


Morning: Resume at 9am tomorrow
Afternoon: Resume at 3pm tomorrow
Evening: Resume at 8pm tomorrow`
  },
  "Scheduled Resumption Reminder": {
    "description": "Sent to remind the user of their scheduled resumption time.",
    "content": `You have chosen to resume this course at 9:00am tomorrow. 

We will continue this course for you at this time.`
  },
  "Scheduled Course Resumption": {
    "description": "Sent when the user’s scheduled course resumption time has been reached, inviting them to continue the course.",
    "content": `Welcome back
You scheduled to resume the course Time Management today at this time.

You can resume your scheduled course by clicking the "Resume Now" button below`
  },
  "Course Completion (Survey)": {
    "description": "Sent after completing the last lesson to prompt the user to provide feedback via a survey.",
    "content": `That was the last lesson 🎊

Well done on finishing the course 🤝

You’ll be getting your certificate 📄 soon so that you can brag about it😎 but first, we want to get your feedback on the course.

We’ll be sending you a quick survey next 🔎`
  },
  "Survey Completion": {
    "description": "Sent after completing the course survey.",
    "content": `That was the last survey question 🎊

Thank you for your feedback about this course 🤝.`
  },
  "3-min Inactivity Reminder": {
    "description": "Sent after a period of inactivity in the course to encourage the user to continue.",
    "content": `Hey [First Name]! It looks like you have been inactive in the course Films 🤔.

In case you are stuck due to technical reasons, please click 'Continue' to resume the course`
  },
  "Inactivity Reminder": {
    "description": "Sent after a longer period of inactivity, encouraging the user to stay on track.",
    "content": `Hey [First Name]! It looks like you have been idle for quite some time 🤔.

Other learners are getting ahead.
 Click 'Continue' to move forward in the course.`
  },
  "Scheduled Reminder": {
    "description": "Sent to remind the user of their course progress and prompt continuation.",
    "content": `Hey [First Name]! You have made 27% progress in the course Customer Service.🎉

Continue now to learn more from the course 🎯.`
  },
  "Dropout": {
    "description": "",
    "content": ""
  }
};
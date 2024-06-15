// import { ApiError } from '../errors'
// import httpStatus from 'http-status'
import httpStatus from 'http-status'
import Courses from '../courses/model.courses'
import { ApiError } from '../errors'
import { CreateSurveyPayload, Question, SurveyInterface, SurveyResponseInterface } from './survey.interfaces'
import Surveys from './survey.model'
import SurveyResponse from './surveyReponse.model'

export const createSurvey = async (surveyPayload: CreateSurveyPayload, teamId: string): Promise<SurveyInterface> => {
  const survey = await Surveys.create({ ...surveyPayload, team: teamId })
  return survey
}

export const updateSurvey = async (surveyPayload: CreateSurveyPayload, id: string): Promise<SurveyInterface | null> => {
  const survey = await Surveys.findByIdAndUpdate(id, { $set: { ...surveyPayload } })
  return survey
}

export const deleteSurvey = async (id: string): Promise<void> => {
  await Courses.updateMany({ survey: id }, { $set: { survey: null } })
  await Surveys.findByIdAndDelete(id)
}

export const addQuestion = async (question: Omit<Question, "id">, surveyId: string): Promise<SurveyInterface | null> => {
  await Surveys.findByIdAndUpdate(surveyId, { $push: { questions: { ...question } } })
  return Surveys.findById(surveyId)
}

export const fetchTeamSurveys = async (team: string): Promise<SurveyInterface[]> => {
  return Surveys.find({ team })
}

export const fetchSurveyResponses = async (course: string): Promise<SurveyResponseInterface[]> => {
  const courseInfo = await Courses.findById(course)
  if (!course) {
    throw new ApiError(httpStatus.NOT_FOUND, "Course not found")
  }
  if (courseInfo && courseInfo.survey) {
    const survey = await Surveys.findById(courseInfo.survey)
    if (!survey) {
      throw new ApiError(httpStatus.NOT_FOUND, "Survey not found")
    }
    const responses: SurveyResponseInterface[] = await SurveyResponse.aggregate([
      { $match: { course } },
      {
        $group: {
          _id: '$student',
          responses: {
            $push: {
              surveyQuestion: '$surveyQuestion',
              response: '$response'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $addFields: {
          responses: {
            $map: {
              input: '$responses',
              as: 'response',
              in: {
                question: {
                  $arrayElemAt: [
                    survey.questions,
                    { $indexOfArray: [survey.questions.map(q => q.id), '$$response.surveyQuestion'] }
                  ]
                },
                answer: '$$response.response'
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          student: {
            _id: '$student._id',
            name: '$student.name',
            email: '$student.email'
          },
          responses: 1
        }
      }
    ])

    return responses
  }

  return []
}
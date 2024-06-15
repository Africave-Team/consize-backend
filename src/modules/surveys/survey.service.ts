// import { ApiError } from '../errors'
// import httpStatus from 'http-status'
import httpStatus from 'http-status'
import Courses from '../courses/model.courses'
import { ApiError } from '../errors'
import { ChartDataInformation, CreateSurveyPayload, Question, ResponseMap, ResponseType, SurveyInterface, SurveyResponseInterface } from './survey.interfaces'
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
  if (!courseInfo) {
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
            id: '$student._id',
            name: { $concat: ['$student.firstName', ' ', '$student.otherNames'] },
            email: '$student.email',
            phoneNumber: '$student.phoneNumber'
          },
          responses: 1
        }
      }
    ])

    return responses
  }

  return []
}

export const fetchMultiChoiceChartData = async (course: string): Promise<ChartDataInformation[]> => {
  const courseInfo = await Courses.findById(course)
  if (!courseInfo) {
    throw new ApiError(httpStatus.NOT_FOUND, "Course not found")
  }
  if (courseInfo && courseInfo.survey) {
    const survey = await Surveys.findById(courseInfo.survey)
    if (!survey) {
      throw new ApiError(httpStatus.NOT_FOUND, "Survey not found")
    }
    const multiChoiceQuestions: ChartDataInformation[] = []
    survey.questions.forEach(question => {
      if (question.responseType === ResponseType.MULTI_CHOICE) {
        multiChoiceQuestions.push({
          surveyId: survey._id,
          questionId: question.id,
          questionText: question.question,
          choices: question.choices,
          responses: [],
          totalCount: 0
        })
      }
    })

    const chartData: ChartDataInformation[] = []

    for (const question of multiChoiceQuestions) {
      // Aggregation pipeline to count responses for each option of the current question
      const responseCounts = await SurveyResponse.aggregate([
        { $match: { survey: question.surveyId, surveyQuestion: question.questionId, course } },
        {
          $group: {
            _id: '$response',
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            option: '$_id',
            count: 1
          }
        }
      ])
      // Create a response map to include all options with counts, defaulting to 0
      const responseMap: ResponseMap = question.choices.reduce((map, choice) => {
        map[choice] = 0
        return map
      }, {} as ResponseMap)

      responseCounts.forEach(rc => {
        responseMap[rc.option] = rc.count
      })

      // Transform the responseMap into an array of objects
      const responseArray = Object.keys(responseMap).map(option => ({
        option,
        count: responseMap[option] || 0
      }))

      // Calculate total count of responses
      const totalCount = responseArray.reduce((sum, { count }) => sum + (count || 0), 0)

      chartData.push({
        surveyId: question.surveyId,
        questionId: question.questionId,
        questionText: question.questionText,
        choices: question.choices,
        responses: responseArray.map((data) => ({ ...data, percent: (data.count / totalCount) * 100 })),
        totalCount
      })
    }

    return chartData
  }

  return []
}
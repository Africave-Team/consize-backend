// import Students from "../students/model.students"
import Enrollments from "../sessions/model"
import Statistics from "../statistics/stats.model";
import Courses from "../courses/model.courses";
import { CourseStatus } from "../courses/interfaces.courses";

export const getCourseStat = async ({searchParams}: any, teamId: string): Promise<any> => {
    const { courseId, date_from, date_to } = searchParams || {}
    
    const matchCriteria: any = { teamId };

    if (courseId) {
      matchCriteria.courseId = courseId;
    }
    
    if (date_from && date_to) {
      matchCriteria.date = {
        $gte: new Date(date_from),
        $lte: new Date(date_to)
      };
    } else if (date_from) {
      matchCriteria.date = {
        $gte: new Date(date_from)
      };
    } else if (date_to) {
      matchCriteria.date = {
        $lte: new Date(date_to)
      };
    }

    const averages = await Statistics.aggregate([
      {
        $match: matchCriteria
      },
      {
        $group: {
          _id: teamId,
          avgCompletionTime: { $avg: "$completionTime" },
          avgCourseProgress: { $avg: "$progress" },
          avgLessonDuration: { $avg: "$lessonDuration" },
          avgSectionDuration: { $avg: "$blockDuration" }
        }
      }
    ]);

    if (averages.length > 0) {
      return averages[0];
    } else {
      return {
        avgCompletionTime: 0,
        avgCourseProgress: 0,
        avgLessonDuration: 0,
        avgSectionDuration: 0
      };
    }
}

export const getLearnersStat = async ({ searchParams }: any, teamId: string): Promise<any> => {
    const {enrollment_date_from, enrollment_date_to, courseId } = searchParams || {}

    const matchConditions: any = { teamId };

    if (courseId) {
      matchConditions.courseId = courseId;
    }

    if (enrollment_date_from && enrollment_date_to) {
      matchConditions.createdAt = {
        $gte: new Date(enrollment_date_from),
        $lte: new Date(enrollment_date_to),
      };
    } else if (enrollment_date_from) {
      matchConditions.createdAt = { $gte: new Date(enrollment_date_from) };
    } else if (enrollment_date_to) {
      matchConditions.createdAt = { $lte: new Date(enrollment_date_to) };
    }

    const stats = await Enrollments.aggregate([
      { $match: matchConditions },
      {
        $facet: {
          totalEnrolled: [{ $count: "count" }],
          totalCompleted: [{ $match: { completed: true } }, { $count: "count" }],
          totalActive: [{ $match: { completed: false, droppedOut: false } }, { $count: "count" }],
          totalDroppedOut: [{ $match: { droppedOut: true } }, { $count: "count" }],
        },
      },
    ]);

    const result = {
      totalEnrolled: stats[0].totalEnrolled[0] ? stats[0].totalEnrolled[0].count : 0,
      totalCompleted: stats[0].totalCompleted[0] ? stats[0].totalCompleted[0].count : 0,
      totalActive: stats[0].totalActive[0] ? stats[0].totalActive[0].count : 0,
      totalDroppedOut: stats[0].totalDroppedOut[0] ? stats[0].totalDroppedOut[0].count : 0,
    };

    console.log(result);
    return result;

}

export const getAssessmentStat = async ({searchParams}: any, teamId: string): Promise<any> => {

    const { courseId, date_from, date_to } = searchParams || {}
    
    const matchCriteria: any = { teamId };

    if (courseId) {
      matchCriteria.courseId = courseId;
    }
    
    if (date_from && date_to) {
      matchCriteria.date = {
        $gte: new Date(date_from),
        $lte: new Date(date_to)
      };
    } else if (date_from) {
      matchCriteria.date = {
        $gte: new Date(date_from)
      };
    } else if (date_to) {
      matchCriteria.date = {
        $lte: new Date(date_to)
      };
    }

    const averages = await Statistics.aggregate([
      {
        $match: matchCriteria
      },
      {
        $group: {
          _id: teamId,
          avgTestScores: { $avg: "$testScore" },
          avgMCQRetakeRates: { $avg: "$retakeRate" },
          avgBaselineScores: { $avg: "$baselineScore" },
          avgEndlineScores: { $avg: "$endlineScore" }
        }
      }
    ]);

    if (averages.length > 0) {
      return averages[0];
    } else {
      return {
        avgTestScores: 0,
        avgMCQRetakeRates: 0,
        avgBaselineScores: 0,
        avgEndlineScores: 0
      };
    }
}

export const getTopCourseMetrics = async (teamId: string): Promise<any> => {
      const result = await Enrollments.aggregate([
      { $match: { teamId: teamId } },
      {
        $group: {
          _id: '$courseId',
          totalEnrolledLearners: { $sum: 1 },
          avgCompletionRate: { $avg: { $cond: [{ $eq: ['$completed', true] }, 1, 0] } },
          avgCourseCompletionTime: { $avg: '$completionTime' }, // Assuming you have a completionTime field
          avgCourseProgress: { $avg: '$progress' }
        }
      },
      {
        $lookup: {
          from: 'courses', // Assuming you have a courses collection
          localField: '_id',
          foreignField: '_id', // Assuming the courseId in the enrollment matches the _id in courses
          as: 'courseDetails'
        }
      },
      { $unwind: '$courseDetails' },
      {
        $project: {
          _id: 0,
          courseName: '$courseDetails.name',
          totalEnrolledLearners: 1,
          avgCompletionRate: 1,
          avgCourseCompletionTime: 1,
          avgCourseProgress: 1
        }
      }
    ]);

    return result;
}

export const getGraphStats = async ({ dateRange }: any, teamId: string): Promise<any> => {
    const { startDate,endDate }: any = dateRange
    const result = await Statistics.aggregate([
      {
        $match: {
          teamId: teamId,
          date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      {
        $group: {
          _id: '$date',
          totalEnrolledLearners: { $sum: 1 },
          avgCourseProgress: { $avg: '$progress' },
          avgCourseCompletionTime: { $avg: '$completionTime' },
        },
      },
      {
        $sort: { _id: 1 }, // Sort by date
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalEnrolledLearners: 1,
          avgCourseProgress: 1,
          avgCourseCompletionTime: 1,
        },
      },
    ]);

    return result;
}

export const getTopLevelStats = async (teamId: string): Promise<any> => {
 const stats = await Courses.aggregate([
        { $match: { owner: teamId } },
        {
            $facet: {
                totalCoursesAdded: [{ $count: 'count' }],
                totalCourseBundles: [
                    { $match: { bundle: true } },
                    { $count: 'count' }
                ],
                totalPublishedCourses: [
                    { $match: { status: CourseStatus.PUBLISHED } },
                    { $count: 'count' }
                ],
                totalDraftCourses: [
                    { $match: { status: CourseStatus.DRAFT } },
                    { $count: 'count' }
                ]
            }
        },
        {
            $project: {
                totalCoursesAdded: { $arrayElemAt: ['$totalCoursesAdded.count', 0] },
                totalCourseBundles: { $arrayElemAt: ['$totalCourseBundles.count', 0] },
                totalPublishedCourses: { $arrayElemAt: ['$totalPublishedCourses.count', 0] },
                totalDraftCourses: { $arrayElemAt: ['$totalDraftCourses.count', 0] }
            }
        }
    ]).exec();

    return stats[0];   
}

export const getCourseCompletionBuckets = async (teamId: string): Promise<any> => {
    const buckets = await Enrollments.aggregate([
    { $match: { teamId } },
    {
      $facet: {
        totalEnrolled: [{ $count: 'total' }],
        totalStarted: [{ $match: { progress: { $gt: 0 } } }, { $count: 'total' }],
        progressBuckets: [
          {
            $bucket: {
              groupBy: "$progress",
              boundaries: [0, 1, 21, 41, 61, 81, 100],
              default: "Other",
              output: {
                count: { $sum: 1 }
              }
            }
          }
        ]
      }
    },
    {
      $project: {
        totalEnrolled: { $arrayElemAt: ["$totalEnrolled.total", 0] },
        totalStarted: { $arrayElemAt: ["$totalStarted.total", 0] },
        progressBuckets: 1
      }
    }
  ]);

  // Format the results
  const result = {
    totalEnrolled: buckets[0]?.totalEnrolled || 0,
    totalStarted: buckets[0]?.totalStarted || 0,
    progress: {
      '0%': 0,
      '1% - 20%': 0,
      '21% - 40%': 0,
      '41% - 60%': 0,
      '61% - 80%': 0,
      '81% - 99%': 0,
      '100%': 0
    }
  };

  if (buckets[0]?.progressBuckets) {
    buckets[0].progressBuckets.forEach((bucket:any) => {
      if (bucket._id === 0) {
        result.progress['0%'] = bucket.count;
      } else if (bucket._id === 1) {
        result.progress['1% - 20%'] = bucket.count;
      } else if (bucket._id === 21) {
        result.progress['21% - 40%'] = bucket.count;
      } else if (bucket._id === 41) {
        result.progress['41% - 60%'] = bucket.count;
      } else if (bucket._id === 61) {
        result.progress['61% - 80%'] = bucket.count;
      } else if (bucket._id === 81) {
        result.progress['81% - 99%'] = bucket.count;
      } else if (bucket._id === 100) {
        result.progress['100%'] = bucket.count;
      }
    });
  }

  return result;
}

export const getStudentsStats = async ({ searchParams }: any, teamId: string): Promise<any> => {
    const { enrollmentDateFrom, enrollmentDateTo, studentName, courseTitle } = searchParams || {}
    const matchStage: any = {
        teamId
    };

    if (enrollmentDateFrom || enrollmentDateTo) {
    matchStage.createdAt = {};
    if (enrollmentDateFrom) {
        matchStage.createdAt.$gte = enrollmentDateFrom;
    }
    if (enrollmentDateTo) {
        matchStage.createdAt.$lte = enrollmentDateTo;
    }
    }

    // Define the aggregation pipeline
    const pipeline = [
    { $match: matchStage },
    {
        $lookup: {
        from: 'students', // Name of the students collection
        localField: 'studentId',
        foreignField: '_id',
        as: 'studentInfo'
        }
    },
    { $unwind: '$studentInfo' }, // Deconstructs the array created by $lookup
    {
        $lookup: {
        from: 'courses', // Name of the courses collection
        localField: 'courseId',
        foreignField: '_id',
        as: 'courseInfo'
        }
    },
    { $unwind: '$courseInfo' }, // Deconstructs the array created by $lookup
    {
        $addFields: {
        fullName: {
            $concat: [
            '$studentInfo.firstName',
            ' ',
            '$studentInfo.otherNames'
            ]
        },
        courseTitle: '$courseInfo.title'
        }
    },
    {
        $match: studentName || courseTitle ? {
        $or: [
            studentName ? { fullName: { $regex: studentName, $options: 'i' } } : {},
            courseTitle ? { courseTitle: { $regex: courseTitle, $options: 'i' } } : {}
        ]
        } : {}
    },
    {
        $project: {
        studentName: '$fullName',
        studentEmail: '$studentInfo.email',
        studentNumber: '$studentInfo.phoneNumber',
        deliveryPlatform: '$distribution', // Assuming distribution represents delivery platform
        cohort: '$teamId', // Assuming teamId represents the cohort
        courseTitle: 1,
        courseProgress: '$progress',
        courseCompletionRate: { $cond: [{ $eq: ['$completed', true] }, 100, '$progress'] }
        }
    }
    ];

    // Execute the aggregation pipeline
    const results = await Enrollments.aggregate(pipeline).exec();
    return results;
}

export const getCourseStudentsStatById = async ({ searchParams }: any, teamId: string, courseId: string): Promise<any> => {
    const { enrollmentDateFrom, enrollmentDateTo} = searchParams || {}
    const matchStage: any = {
    teamId,
    courseId
    };

    if (enrollmentDateFrom || enrollmentDateTo) {
    matchStage.createdAt = {};
    if (enrollmentDateFrom) {
        matchStage.createdAt.$gte = enrollmentDateFrom;
    }
    if (enrollmentDateTo) {
        matchStage.createdAt.$lte = enrollmentDateTo;
    }
    }

    // Define the aggregation pipeline
    const pipeline = [
    { $match: matchStage },
    {
        $lookup: {
        from: 'students', // Name of the students collection
        localField: 'studentId',
        foreignField: '_id',
        as: 'studentInfo'
        }
    },
    { $unwind: '$studentInfo' }, // Deconstructs the array created by $lookup
    {
        $addFields: {
        fullName: {
            $concat: [
            '$studentInfo.firstName',
            ' ',
            '$studentInfo.otherNames'
            ]
        }
        }
    },
    {
        $project: {
        studentName: '$fullName',
        email: '$studentInfo.email',
        cohortName: '$teamId', // Assuming teamId represents the cohort name
        enrollmentDate: '$createdAt',
        progressPercentage: '$progress',
        testScore: '$scores'
        }
    }
    ];

    // Execute the aggregation pipeline
    const results = await Enrollments.aggregate(pipeline).exec();
    return results;
}
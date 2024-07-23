// import Courses from "../courses/model.courses"
// import Students from "../students/model.students"
import Enrollments from "../sessions/model"

// export const getCourseStat = async ({searchParams}: any, teamId: string): Promise<void> => {
//     // const {enrollemt_date, course_name, date_from, date_to } = searchParams

// }

export const getLearnersStat = async ({ searchParams }: any, teamId: string): Promise<any> => {
    const {enrollment_date_from, enrollment_date_to, courseId } = searchParams

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

// export const getAssessmentStat = async ({searchParams}: any, teamId: string): Promise<void> => {
    
// }
import httpStatus from 'http-status'
import { courseService } from '../courses'
import { ApiError } from '../errors'
import { CohortsInterface, CohortsStatus, CreateCohortInterface, EnrollCohortInterface } from "./interface.cohorts"
import Cohorts from "./model.cohorts"
import { CourseStatus, Distribution } from '../courses/interfaces.courses'
import { slackServices } from '../slack'
import { teamService } from '../teams'
import { Student, studentService } from '../students'
import { StudentInterface } from '../students/interface.students'
import { MessageActionButtonStyle, MessageBlockType, SendSlackMessagePayload, SlackActionType, SlackTextMessageTypes } from '../slack/interfaces.slack'
import { agenda } from '../scheduler'
import { COHORT_SCHEDULE, COHORT_SCHEDULE_STUDENT, SEND_SLACK_MESSAGE } from '../scheduler/MessageTypes'
import moment from 'moment-timezone'
import randomstring from "randomstring"
import { ACCEPT_INVITATION, REJECT_INVITATION } from '../webhooks/interfaces.webhooks'
import { sessionService } from '../sessions'
import { MAX_FREE_PLAN_MONTHLY_ENROLLMENTS } from '../../config/constants'
import { subscriptionService } from '../subscriptions'

const checkSubscriptionEnrollmentCount = async (count: number, teamId: string) => {
    const subscription = await subscriptionService.fetchMyActiveSubscription(teamId)
    if (!subscription) {
        // throw api error
        throw new ApiError(httpStatus.BAD_REQUEST, "We found no active subscription for your account")
    }
    const plan = await subscriptionService.fetchSubscriptionPlanById(subscription.plan as string)
    if (!plan) {
        // throw api error
        throw new ApiError(httpStatus.BAD_REQUEST, "Could not verify your subscription plan")
    }
    if (plan.price === 0) {
        // free plan
        // get all the team's enrollments
        const today = new Date()
        const enrolled = await sessionService.countTeamEnrollmentsPerMonth(teamId, today.getMonth(), today.getFullYear())
        if ((enrolled + count) > MAX_FREE_PLAN_MONTHLY_ENROLLMENTS) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Your client account has exceeded the maximum enrollments for their subscription plan")
        }
    }
}

export const createCohort = async ({ courseId, distribution, name }: CreateCohortInterface): Promise<CohortsInterface> => {
    const courseInformation = await courseService.fetchSingleCourse({ courseId })
    if (!courseInformation) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Could not resolve the provided course ID")
    }
    let team = await teamService.fetchTeamById(courseInformation.owner)
    if (!team) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Could not resolve the provided team ID")
    }
    // resolve slack or whatsapp
    if (distribution === Distribution.SLACK) {
        if (!team || !team.slackToken) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Slack has not been connected to your account")
        }
    }

    const cohort = new Cohorts({
        name, distribution, courseId, status: CohortsStatus.PENDING, shortCode: randomstring.generate({
            length: 5,
            charset: "alphanumeric"
        }).toLowerCase()
    })
    await cohort.save()
    return cohort
}

export const updateCohort = async (id: string, payload: Pick<CohortsInterface, "name" | "default">): Promise<void> => {

    const cohort = await Cohorts.findById(id)
    if (cohort) {
        if (payload.name) {
            cohort.name = payload.name
        }
        if ('default' in payload) {
            cohort.default = payload.default
            if (payload.default) {
                await Cohorts.updateMany({ courseId: cohort.courseId }, { $set: { default: false } })
            }
        }
        await cohort.save()
    }
}


export const enrollCohort = async ({ courseId, cohortId, members, channels, students, schedule, date, time }: EnrollCohortInterface): Promise<CohortsInterface> => {
    const courseInformation = await courseService.fetchSingleCourse({ courseId })
    if (!courseInformation) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Could not resolve the provided course ID")
    }
    let team = await teamService.fetchTeamById(courseInformation.owner)
    if (!team) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Could not resolve the provided team ID")
    }

    let cohort = await Cohorts.findById(cohortId)
    if (!cohort) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid cohort id provided")
    }

    // list of student ids
    let cohortMembers: string[] = []
    let cohortMembersInfo: { id: string, tz: string }[] = []
    // resolve slack or whatsapp
    if (cohort.distribution === Distribution.SLACK) {
        if (team && team.slackToken) {
            let slackIds: string[] = []
            if (members) {
                await checkSubscriptionEnrollmentCount(members.length, courseInformation.owner)
                slackIds = members
            }
            if (channels) {
                // @ts-ignore
                const channelMembers = await Promise.all(channels.map(e => slackServices.fetchChannelMembers(team.slackToken, e)))
                slackIds = [...slackIds, ...channelMembers.flat()]
            }
            // check if the slack ids are matched with any existing students
            const existingStudents = await Student.find({ slackId: { $in: slackIds } })

            const nonExistingStudents = slackIds.filter((id) => !existingStudents.find(e => e.slackId === id))
            // for non-existing members, initiate onboarding process
            // @ts-ignore
            const profiles = await Promise.all(nonExistingStudents.map(e => slackServices.fetchSlackUserProfile(team.slackToken, e)))
            // create student info for all profiles
            const studentsList = await Promise.all(profiles.map((user) => {
                if (user && !user.deleted && !user.is_bot) {
                    return studentService.registerStudentSlack({
                        email: "",
                        slackId: user.id,
                        firstName: user.profile.first_name,
                        otherNames: user.profile.last_name,
                        phoneNumber: user.profile.phone,
                        tz: user.tz
                    })
                }
                return null
            }))

            let list = studentsList.filter((e) => e !== null) as StudentInterface[]
            cohortMembers = [...cohortMembers, ...existingStudents.map((e) => e.id), ...list.map(e => e.id)]
            cohortMembersInfo = [...cohortMembersInfo, ...existingStudents.map((e) => ({ id: e.id, tz: e.tz })), ...list.map((e) => ({ id: e.id, tz: e.tz }))]
            // send onboarding messages to all profiles
            if (team !== null && team.slackToken) {
                await Promise.allSettled(profiles.map(async (user): Promise<void> => {
                    if (user && team && team.slackToken) {
                        // @ts-ignore
                        const token = team.slackToken
                        const conversation = await slackServices.createConversation(token, user.id)
                        if (conversation) {
                            agenda.now<SendSlackMessagePayload>(SEND_SLACK_MESSAGE, {
                                channel: conversation,
                                accessToken: token,
                                message: {
                                    blocks: [
                                        {
                                            type: MessageBlockType.SECTION,
                                            fields: [
                                                {
                                                    type: SlackTextMessageTypes.MARKDOWN,
                                                    text: `Welcome *${user.profile.first_name}*`
                                                },
                                                {
                                                    type: SlackTextMessageTypes.MARKDOWN,
                                                    text: `You have been invited by your organization admin to participate in courses distributed through Consize. \n\nClick the button below to accept this invitation.`
                                                }
                                            ]
                                        },
                                        {
                                            type: MessageBlockType.ACTIONS,
                                            elements: [
                                                {
                                                    type: SlackActionType.BUTTON,
                                                    style: MessageActionButtonStyle.PRIMARY,
                                                    text: {
                                                        type: SlackTextMessageTypes.PLAINTEXT,
                                                        "emoji": true,
                                                        text: "Accept invitation",
                                                    },
                                                    value: ACCEPT_INVITATION
                                                },
                                                {
                                                    type: SlackActionType.BUTTON,
                                                    style: MessageActionButtonStyle.DANGER,
                                                    text: {
                                                        type: SlackTextMessageTypes.PLAINTEXT,
                                                        "emoji": true,
                                                        text: "Reject invitation",
                                                    },
                                                    value: REJECT_INVITATION
                                                }
                                            ]
                                        }
                                    ]
                                }
                            })

                            await Student.findOneAndUpdate({ slackId: user.id }, { channelId: conversation })
                        }
                    }
                }))
            }
        } else {
            throw new ApiError(httpStatus.BAD_REQUEST, "Slack has not been connected to your account")
        }
    }

    if (cohort.distribution === Distribution.WHATSAPP) {
        if (students) {
            await checkSubscriptionEnrollmentCount(students.length, courseInformation.owner)
            const studentsData = await Promise.all(students.map(e => studentService.findStudentById(e)))
            cohortMembers = studentsData.filter(e => e && e.id).map(e => {
                if (e !== null) {
                    cohortMembersInfo.push({
                        id: e._id,
                        tz: e.tz
                    })
                    return e._id
                }
                return ""
            })
        }
    }
    // @ts-ignore
    cohort = Cohorts.findByIdAndUpdate(cohortId, { $set: { date, time, members: cohortMembers, schedule, status: CohortsStatus.PENDING } }, { new: true })
    if (!cohort) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid cohort id provided")
    }
    if (schedule) {
        // use agenda to schedule the event
        for (let student of cohortMembersInfo) {
            const now = moment.tz(student.tz)
            const tmi = moment(`${date} ${time}`).subtract(now.utcOffset(), 'minutes')
            agenda.schedule<{ cohortId: string, studentId: string }>(tmi.toDate(), COHORT_SCHEDULE_STUDENT, { cohortId, studentId: student.id })
        }
    } else {
        if (courseInformation.status === CourseStatus.PUBLISHED) {
            agenda.now<{ cohortId: string }>(COHORT_SCHEDULE, { cohortId })
        }
    }
    return cohort
}

export const fetchCohorts = async (courseId: string, distribution: Distribution): Promise<CohortsInterface[]> => {
    const cohorts = await Cohorts.find({
        courseId: courseId,
        distribution
    }).populate("members")
    return cohorts
}

export const fetchGeneralCohorts = async (courseId: string): Promise<CohortsInterface[]> => {
    const cohorts = await Cohorts.find({
        $or: [
            {
                courseId: courseId
            }
        ]
    }).populate("members")
    return cohorts
}


export const resolveCohortWithShortCode = async (code: string): Promise<CohortsInterface | null> => {
    const cohort = await Cohorts.findOne({
        shortCode: code
    })
    return cohort
}

export const deleteCohort = async (cohortId: string): Promise<void> => {
    const jobs = await agenda.jobs({ 'data.cohortId': cohortId })
    for (let job of jobs) {
        job.remove()
    }
    await Cohorts.deleteOne({ _id: cohortId })
}


export const initiateCourseForCohort = async function (cohortId: string) {
    const cohort = await Cohorts.findById(cohortId)
    if (cohort) {
        if (cohort.distribution === Distribution.SLACK) {
            await Promise.all(cohort.members.map(async (student) => {
                await slackServices.enrollStudentToCourseSlack(student, cohort.courseId, cohort.id)
            }))
        } else {
            await Promise.all(cohort.members.map(async (student: string) => {
                await studentService.enrollStudentToCourse(student, cohort.courseId, "api", {}, cohort.id)
            }))
        }

        cohort.status = CohortsStatus.DISABLED
        await cohort.save()
    }
}


export const initiateCourseForCohortForSingleStudent = async function (cohortId: string, studentId: string) {
    const cohort = await Cohorts.findById(cohortId)
    if (cohort) {
        if (cohort.distribution === Distribution.SLACK) {
            await slackServices.enrollStudentToCourseSlack(studentId, cohort.courseId)
        } else {
            await studentService.enrollStudentToCourse(studentId, cohort.courseId, "api")
        }

        cohort.status = CohortsStatus.DISABLED
        await cohort.save()
    }
}
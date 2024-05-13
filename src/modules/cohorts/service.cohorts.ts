import httpStatus from 'http-status'
import { courseService } from '../courses'
import { ApiError } from '../errors'
import { CohortsInterface, CohortsStatus, CreateCohortInterface } from "./interface.cohorts"
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
import { ACCEPT_INVITATION, REJECT_INVITATION } from '../webhooks/interfaces.webhooks'

export const createCohort = async ({ courseId, distribution, name, members, channels, students, schedule, date, time }: CreateCohortInterface): Promise<CohortsInterface> => {
    const courseInformation = await courseService.fetchSingleCourse({ courseId })
    if (!courseInformation) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Could not resolve the provided course ID")
    }
    let team = await teamService.fetchTeamById(courseInformation.owner)
    if (!team) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Could not resolve the provided team ID")
    }

    if (!team.slackToken) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Slack token is yet to be set")
    }

    // list of student ids
    let cohortMembers: string[] = []
    let cohortMembersInfo: { id: string, tz: string }[] = []
    // resolve slack or whatsapp
    if (distribution === Distribution.SLACK && team && team.slackToken) {
        let slackIds: string[] = []
        if (members) {
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
        if (students) {
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
    const cohort = new Cohorts({ name, date, time, members: cohortMembers, schedule, distribution, courseId, status: CohortsStatus.PENDING })
    await cohort.save()
    if (schedule) {
        // use agenda to schedule the event
        // calculate the time in minutes from now till the schedule date/time
        const combinedDateTime = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm')

        // Calculate the difference in minutes between now and the combined date
        for (let student of cohortMembersInfo) {
            agenda.schedule<{ cohortId: string, studentId: string }>(combinedDateTime.tz(student.tz).toDate(), COHORT_SCHEDULE_STUDENT, { cohortId: cohort.id, studentId: student.id })
        }
    } else {
        if (courseInformation.status === CourseStatus.PUBLISHED) {
            agenda.now<{ cohortId: string }>(COHORT_SCHEDULE, { cohortId: cohort.id })
        }
    }
    return cohort
}

export const fetchCohorts = async (courseId: string): Promise<CohortsInterface[]> => {
    const cohorts = await Cohorts.find({ courseId: courseId }).populate("members")
    return cohorts
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
                await slackServices.enrollStudentToCourseSlack(student, cohort.courseId)
            }))
        } else {
            await Promise.all(cohort.members.map(async (student) => {
                await studentService.enrollStudentToCourse(student, cohort.courseId)
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
            await studentService.enrollStudentToCourse(studentId, cohort.courseId)
        }

        cohort.status = CohortsStatus.DISABLED
        await cohort.save()
    }
}
import { NewTeamUser, TeamsInterface } from './interfaces.teams'
import Team from './model.teams'
import { User } from '../user'
import { pgModel, pgService } from '../permission-groups'
import { ApiError } from '../errors'
import httpStatus from 'http-status'
import { QueryResult } from '../paginate/paginate'
import { IUserDoc } from '../user/user.interfaces'

export const createTeam = async (name: string, ownerId: string): Promise<TeamsInterface> => {
  const team = await Team.create({
    name, owner: ownerId
  })
  return team
}

export const fetchTeamInfo = async (teamid: string): Promise<TeamsInterface> => {
  const team = await Team.findById(teamid)
  if (!team) throw new ApiError(httpStatus.NOT_FOUND, 'Team not found')
  return team
}

export const updateTeamInfo = async (teamid: string, payload: Partial<Omit<TeamsInterface, "_id" | "owner" | "createdAt" | "updatedAt">>): Promise<TeamsInterface> => {
  const team = await Team.findByIdAndUpdate(teamid, { $set: payload }, { new: true })
  if (!team) throw new ApiError(httpStatus.NOT_FOUND, 'Team not found')
  return team
}
export const fetchTeamById = async (teamId: string): Promise<TeamsInterface | null> => {
  const team = await Team.findById(teamId)
  return team
}

export const fetchTeamMembersById = async (teamId: string, _: string, page: number = 1): Promise<QueryResult<IUserDoc>> => {
  const members = await User.paginate({ team: teamId }, { sortBy: 'createdAt:desc', page, limit: 10 })
  return members
}

export const createInvitedMember = async (teamId: string, payload: NewTeamUser): Promise<NewTeamUser> => {
  if (await User.isEmailTaken(payload.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken')
  }
  let pg = await pgModel.findById(payload.permissionGroup)
  if (!pg) {
    pg = await pgModel.findOne({ name: 'creative' })
    if (!pg) {
      await pgService.seedPermissionGroups()
      pg = await pgModel.findOne({ name: 'creative' })
    }
  }

  await User.create({
    team: teamId, name: payload.name, email: payload.email,
    password: "Jankal442048@",
    permissionGroup: {
      name: pg?.name,
      value: pg?.value,
      permissions: pg?.permissions
    }
  })
  return payload
}


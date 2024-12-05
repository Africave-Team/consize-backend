import { ITeamDoc, NewTeamUser, TeamInterfaceWithOwner, TeamsInterface } from './interfaces.teams'
import Team from './model.teams'
import { User } from '../user'
import { pgModel, pgService } from '../permission-groups'
import { ApiError } from '../errors'
import httpStatus from 'http-status'
import { QueryResult } from '../paginate/paginate'
import { IUserDoc } from '../user/user.interfaces'
import { FilterQuery } from 'mongoose'

import randomstring from "randomstring"
import { Distribution } from '../courses/interfaces.courses'
import config from '../../config/config'
import axios, { AxiosResponse } from 'axios'
import { agenda } from '../scheduler'
import { DELAYED_VERCEL_VERIFICATION } from '../scheduler/MessageTypes'

export const createTeam = async (name: string, ownerId: string): Promise<TeamsInterface> => {
  let code = name.toLowerCase().replace(/[&. ]/g, (match) => {
    switch (match) {
      case '&':
        return 'and'
      case '.':
        return '-'
      case ' ':
        return '-'
      default:
        return match
    }
  })

  let exists = await Team.findOne({ shortCode: code })
  if (exists) {
    let extra = randomstring.generate({
      charset: 'numeric',
      length: 3
    })
    code += '-' + extra
  }
  const team = await Team.create({
    name, owner: ownerId, shortCode: code, domains: [
      {
        host: `${code}.${config.env === "development" ? "staging-app." : ""}consize.com`,
        internal: true,
        vercelVerified: true,
        dnsVerified: true
      }
    ],
    channels: [
      {
        channel: Distribution.WHATSAPP,
        enabled: false
      },
      {
        channel: Distribution.SLACK,
        enabled: false
      }
    ]
  })
  return team
}

export const fetchTeamInfo = async (teamid: string): Promise<TeamsInterface> => {
  const team = await Team.findById(teamid)
  if (!team) throw new ApiError(httpStatus.NOT_FOUND, 'Team not found')
  return team
}


export const fetchTeams = async ({ page, pageSize, search }: { page: number, pageSize: number, search: string | undefined }): Promise<QueryResult<TeamsInterface>> => {
  let query: FilterQuery<ITeamDoc> = {}
  if (search && search.length > 0) {
    query.name = { $regex: search, $options: "i" }
  }
  const teams = await Team.paginate(query, { page, limit: pageSize, populate: 'owner', sort: { _id: -1 } })
  return teams
}

export const syncTeamsDomains = async () => {
  const teams = await Team.find({ $or: [{ domains: [] }, { domains: { $exists: false } }] })
  for (let team of teams) {
    team.domains = [
      {
        host: `${team.shortCode}.${config.env === "development" ? "staging-app." : ""}consize.com`,
        internal: true,
        vercelVerified: true,
        dnsVerified: true
      }
    ]
    await team.save()
  }
}

export const verifyTeamDomain = async function (teamId: string, host: string) {
  let projectId = "prj_2Vl7cXqBhFfybRPZrK92UuYppTJr"
  if (config.env === "development") {
    projectId = "prj_3drbRY0AMW7ms9k6y1kLqjvjNdVB"
  }
  const result: AxiosResponse<{ verified: boolean }> = await axios.get(`https://api.vercel.com/v9/projects/${projectId}/domains/${host}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.vercelToken}`
    }
  })

  if (result.data.verified) {
    const team = await Team.findById(teamId)
    if (team) {
      let index = team.domains.findIndex(e => e.host === host)
      if (index >= 0) {
        const domain = team.domains[index]

        if (domain) {
          domain.dnsVerified = true
          domain.vercelVerified = true
        }
      }
      await team.save()
    }
  } else {
    agenda.schedule<{ teamId: string, host: string }>("in 60 seconds", DELAYED_VERCEL_VERIFICATION, { teamId, host })
  }

}

export const addTeamsDomains = async (teamId: string, host: string) => {
  try {
    const team = await Team.findById(teamId)
    if (!team) throw new ApiError(httpStatus.NOT_FOUND, 'Team not found')
    team.domains.push({
      host,
      internal: false,
      vercelVerified: false,
      dnsVerified: false
    })
    console.log(config.env)
    let projectId = "prj_2Vl7cXqBhFfybRPZrK92UuYppTJr"
    if (config.env === "development") {
      projectId = "prj_3drbRY0AMW7ms9k6y1kLqjvjNdVB"
    }

    await axios.post(`https://api.vercel.com/v9/projects/${projectId}/domains`, {
      name: host
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.vercelToken}`
      }
    })
    await team.save()

    agenda.schedule<{ teamId: string, host: string }>("in 60 seconds", DELAYED_VERCEL_VERIFICATION, { teamId, host })

    return team
  } catch (error) {
    console.log(JSON.stringify(error))
  }
}

export const removeTeamsDomains = async (teamId: string, host: string) => {
  const team = await Team.findById(teamId)
  if (!team) throw new ApiError(httpStatus.NOT_FOUND, 'Team not found')
  let index = team.domains.findIndex(e => e.host === host)
  if (index >= 0) {
    team.domains.splice(index, 1)
  }
  await team.save()
  let projectId = "prj_2Vl7cXqBhFfybRPZrK92UuYppTJr"
  if (config.env === "development") {
    projectId = "prj_3drbRY0AMW7ms9k6y1kLqjvjNdVB"
  }

  try {
    await axios.delete(`https://api.vercel.com/v9/projects/${projectId}/domains/${host}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.vercelToken}`
      }
    })
  } catch (error) {
    console.log("Delete failed")
  }

  return team
}

export const updateTeamsDomains = async (teamId: string, host: string) => {
  const team = await Team.findById(teamId)
  if (!team) throw new ApiError(httpStatus.NOT_FOUND, 'Team not found')
  let index = team.domains.findIndex(e => e.host === host)
  let oldHost = ''
  if (index >= 0) {
    oldHost = team.domains[index]?.host || ''
  }

  if (oldHost !== host) {
    if (index >= 0) {
      let domain = team.domains[index]
      if (domain) {
        domain.host = host
        domain.vercelVerified = false
        domain.dnsVerified = false
      }
    }
    await team.save()
    let projectId = "prj_2Vl7cXqBhFfybRPZrK92UuYppTJr"
    if (config.env === "development") {
      projectId = "prj_3drbRY0AMW7ms9k6y1kLqjvjNdVB"
    }
    if (oldHost.length > 0) {
      try {
        await axios.delete(`https://api.vercel.com/v9/projects/${projectId}/domains/${oldHost}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.vercelToken}`
          }
        })
      } catch (error) {
        console.log("Delete failed")
      }
    }
    await axios.post(`https://api.vercel.com/v9/projects/${projectId}/domains`, {
      name: host
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.vercelToken}`
      }
    })

    agenda.schedule<{ teamId: string, host: string }>("in 60 seconds", DELAYED_VERCEL_VERIFICATION, { teamId, host })

  }



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


export const resolveTeamWithShortcode = async (code: string): Promise<TeamInterfaceWithOwner | null> => {
  const team = await Team.findOne({ 'domains.host': code }).populate('owner')
  // @ts-ignore
  return team
}

export const fetchTeamByIdWithOwner = async (teamId: string): Promise<TeamInterfaceWithOwner | null> => {
  const team = await Team.findById(teamId).populate('owner')
  // @ts-ignore
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

export const updateTeamShortCode = async function () {
  let teams = await Team.find({})

  for (let team of teams) {
    let code = team.name.toLowerCase().replace(/[&. ]/g, (match) => {
      switch (match) {
        case '&':
          return 'and'
        case '.':
          return '-'
        case ' ':
          return '-'
        default:
          return match
      }
    })

    let exists = await Team.findOne({ shortCode: code, _id: { $ne: team.id } })
    if (exists) {
      let extra = randomstring.generate({
        charset: 'numeric',
        length: 3
      })
      code += '-' + extra
    }
    await Team.updateOne({ _id: team.id }, { shortCode: code })
  }
}


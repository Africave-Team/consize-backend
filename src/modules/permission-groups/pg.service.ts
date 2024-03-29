// import httpStatus from 'http-status'
import PG from './pg.model'
// import ApiError from '../errors/ApiError'
import { IPGDoc, permissions, Permissions, permissionsCreative } from './pg.interfaces'


export const fetchAllPermissionsGroups = async (): Promise<IPGDoc[]> => {
  const all = await PG.find({})
  if (all.length === 0) {
    await seedPermissionGroups()
  }
  return PG.find({})
}

export const fetchAllPermissions = async (): Promise<Permissions> => {
  return permissions
}

export const seedPermissionGroups = async (): Promise<void> => {
  await PG.deleteMany({})
  await PG.create({
    name: 'Executive', value: 'executive', permissions
  })

  await PG.create({
    name: 'Creative', value: 'creative', permissions: permissionsCreative
  })
}

import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import * as pgService from './pg.service'


export const fetchAllPgs = catchAsync(async (_: Request, res: Response) => {
  let groups = await pgService.fetchAllPermissionsGroups()
  return res.status(200).json(groups)
})

export const fetchAllPermissions = catchAsync(async (_: Request, res: Response) => {
  let groups = await pgService.fetchAllPermissions()
  return res.status(200).json(groups)
})

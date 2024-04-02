import express, { Request, Response, Router } from 'express'
import authRoute from './auth.route'
import userRoute from './user.route'
import teamRoute from './team.route'
import uploadRoute from './upload.route'
import coursesRoute from './courses.route'
import cohortsRoute from './cohorts.route'
import permissionRoute from './permissions.route'
import blocksRoute from './blocks.route'
import config from '../../config/config'

const router = express.Router()

interface IRoute {
  path: string
  route: Router
}

const defaultIRoute: IRoute[] = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/upload',
    route: uploadRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/teams',
    route: teamRoute,
  },
  {
    path: '/permissions',
    route: permissionRoute
  },
  {
    path: '/courses',
    route: coursesRoute
  },
  {
    path: '/cohorts',
    route: cohortsRoute
  },
  {
    path: '/blocks',
    route: blocksRoute
  }
]

const devIRoute: IRoute[] = [
  // IRoute available only in development mode
]
router.get('/', (_: Request, res: Response): void => {
  res.send(`You've reached api routes of Consize`)
})
defaultIRoute.forEach((route) => {
  router.use(route.path, route.route)
})
/* istanbul ignore next */
if (config.env === 'development') {
  devIRoute.forEach((route) => {
    router.use(route.path, route.route)
  })
}

export default router

import express, { Request, Response, Router } from 'express'
import authRoute from './auth.routes'
import coursesRoute from './courses.routes'
import companyRoute from './company.routes'
import config from '../../../config/config'

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
    path: '/company',
    route: companyRoute,
  },
  {
    path: '/course',
    route: coursesRoute
  }
]

const devIRoute: IRoute[] = [
  // IRoute available only in development mode
]
router.get('/', (_: Request, res: Response): void => {
  res.send(`You've reached admin api routes of Consize`)
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

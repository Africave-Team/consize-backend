import express, { Request, Response, Router } from 'express'
import authRoute from './auth.route'
import userRoute from './user.route'
import teamRoute from './team.route'
import uploadRoute from './upload.route'
import coursesRoute from './courses.route'
import cohortsRoute from './cohorts.route'
import lessonsRoute from './lessons.route'
import permissionRoute from './permissions.route'
import blocksRoute from './blocks.route'
import signaturesRoute from './signatures.route'
import quizzesRoute from './quizzes.route'
import generatorRoute from './generators'
import studentsRoute from './students'
import whatsappRoute from './whatsapp.route'
import slackRoute from './slack.route'
import surveyRoute from "./survey.route"
import adminRoute from "./admin"
import config from '../../config/config'

const router = express.Router()

interface IRoute {
  path: string
  route: Router
}

const defaultIRoute: IRoute[] = [
  {
    path: '/console',
    route: adminRoute,
  },
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
    path: '/lessons',
    route: lessonsRoute
  },
  {
    path: '/cohorts',
    route: cohortsRoute
  },
  {
    path: '/blocks',
    route: blocksRoute
  },
  {
    path: '/signatures',
    route: signaturesRoute
  },
  {
    path: '/quiz',
    route: quizzesRoute
  },
  {
    path: '/students',
    route: studentsRoute
  },
  {
    path: "/whatsapp",
    route: whatsappRoute
  },
  {
    path: "/survey",
    route: surveyRoute
  },
  {
    path: "/generator",
    route: generatorRoute
  },
  {
    path: "/slack",
    route: slackRoute
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

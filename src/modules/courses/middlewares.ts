import { Request, Response, NextFunction } from 'express'
import { downloadFileToDir } from '../generators/generator.service'

const downloadFiles = async (req: Request, resolve: any, reject: any) => {
  const { files } = req.body
  try {
    if (files && Array.isArray(files)) {
      await Promise.all(files.map((file) => downloadFileToDir(file, 'files/')))
      req.body.files = files.map(e => 'files/' + (e.replace('https://storage.googleapis.com/kippa-cdn-public/', '').split('/')[1]))
    }
    resolve()
  } catch (error) {
    reject()
  }
}

const downloadMiddleware =
  () =>
    async (req: Request, _: Response, next: NextFunction) =>
      new Promise<void>((resolve, reject) => {
        downloadFiles(req, resolve, reject)
      })
        .then(() => next())
        .catch((err) => next(err))

export default downloadMiddleware

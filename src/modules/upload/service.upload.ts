// import httpStatus from 'http-status'
// import ApiError from '../errors/ApiError'
import { Storage } from '@google-cloud/storage'
import serviceAccount from '../../gcp-details.json'

export const uploadFileToCloudStorage = async (file: Buffer, destination: string): Promise<string> => {
  const storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key?.split(String.raw`\n`).join("\n"),
    },
  })


  const bucketName = 'kippa-cdn-public'
  const bucket = storage.bucket(bucketName)

  return new Promise((resolve, reject) => {
    const fileStream = bucket.file(destination).createWriteStream()

    fileStream.on('error', (err) => {
      console.error(`Error uploading file: ${err}`)
      reject(err)
    })

    fileStream.on('finish', () => {
      console.log(`${destination} uploaded successfully.`)
      fileStream.end()
      resolve(encodeURI(`https://storage.googleapis.com/kippa-cdn-public/${destination}`))
    })

    fileStream.end(file)
  })
}

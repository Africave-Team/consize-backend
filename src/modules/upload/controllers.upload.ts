import { Request, Response } from 'express'
import ApiError from '../errors/ApiError'
import catchAsync from '../utils/catchAsync'
import { uploadFileToCloudStorage } from '../upload/service.upload'
import Busboy from 'busboy'
import { Readable } from 'stream'
import { logger } from '../logger'

// Define a function to convert file stream to buffer
async function streamToBuffer (fileStream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []

    // Listen for 'data' event, accumulating chunks into an array
    fileStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    // Listen for 'end' event, indicating the end of the stream
    fileStream.on('end', () => {
      // Concatenate all chunks into a single buffer
      const buffer: Buffer = Buffer.concat(chunks)
      resolve(buffer)
    })

    // Listen for 'error' event, in case of any errors
    fileStream.on('error', (error: Error) => {
      reject(error)
    })
  })
}

export const uploadFile = catchAsync(async (req: Request, res: Response) => {

  const busboy = Busboy({ headers: req.headers })
  let destination = 'microlearn-images/'
  busboy.on('file', async (_, file, { filename, mimeType }) => {
    if (mimeType === 'application/pdf') {
      destination = 'microlearn-pdfs/'
    }
    destination = destination + filename
    try {
      const buffer = await streamToBuffer(file)
      const url = await uploadFileToCloudStorage(buffer, destination)
      return res.send({ data: url, message: "File uploaded successfully" })
    } catch (error) {
      logger.info(error)
      throw new ApiError(503, "Could not upload this file")
    }
  })
  req.pipe(busboy)
})

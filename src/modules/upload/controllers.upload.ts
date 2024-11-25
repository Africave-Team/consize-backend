import { Request, Response } from 'express'
import catchAsync from '../utils/catchAsync'
import { reencodeVideo, uploadFileToCloudStorage, handleVideoReencoding } from '../upload/service.upload'
import Busboy from 'busboy'
import { Readable } from 'stream'
import path from 'path'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
const projectRoot = process.cwd()

const localVideoPath = path.join(projectRoot, 'generated-files')

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
  const uploads: { url?: string, filename?: string, error?: string }[] = [] // To track multiple file uploads if needed
  let destination = 'microlearn-images/'
  busboy.on('file', async (_, file, { mimeType, filename: fileName }) => {
    let brightness = ''
    let sections = fileName.split('-')
    let section = sections[0] ? sections[0] : ''
    if (section.startsWith('x')) {
      brightness = section + '-'
    }
    let filename = brightness + new Date().getTime().toString() + '.' + fileName.split('.')[1]
    if (mimeType === 'application/pdf') {
      destination = 'microlearn-pdfs/'
    }

    if (mimeType.startsWith('video/')) {
      if (!existsSync(localVideoPath)) {
        mkdirSync(localVideoPath)
      }

      try {
        // Convert stream to buffer and save temporarily
        const tempFilePath = path.join(localVideoPath, filename)
        const buffer = await streamToBuffer(file)
        writeFileSync(tempFilePath, buffer)

        // Analyze video encoding
        // const metadata = await getVideoMetadata(tempFilePath)

        // // Check if video is already in desired format (H.264 for video and AAC for audio)
        // const videoCodec = metadata.video_codec
        // const audioCodec = metadata.audio_codec

        // if (videoCodec !== 'h264' || audioCodec !== 'aac') {
        // Re-encode video if it does not conform to H.264 and AAC
        const outputFileName = `reencoded-${filename}`
        const outputFilePath = path.join(localVideoPath, outputFileName)

        await reencodeVideo(tempFilePath, outputFilePath)

        // Upload re-encoded video
        const reencodedBuffer = readFileSync(outputFilePath)
        const url = await uploadFileToCloudStorage(reencodedBuffer, destination + outputFileName)

        // Clean up temp files
        unlinkSync(tempFilePath)
        unlinkSync(outputFilePath)

        uploads.push({ url, filename: outputFileName })
        // } else {
        //   // Upload original video if encoding is correct
        //   const url = await uploadFileToCloudStorage(buffer, destination + filename)

        //   // Clean up temp file
        //   unlinkSync(tempFilePath)

        //   uploads.push({ url, filename })
        // }

      } catch (error) {
        console.error(error)
        uploads.push({ error: `Could not process video file: ${filename}` })
      }

    } else {
      // Handle non-video files (images, PDFs, etc.)
      if (mimeType === 'application/pdf') {
        destination = 'microlearn-pdfs/'
      }

      destination += filename

      try {
        // Convert stream to buffer and upload non-video files as is
        const buffer = await streamToBuffer(file)
        const url = await uploadFileToCloudStorage(buffer, destination)

        uploads.push({ url, filename })

      } catch (error) {
        console.error(error)
        uploads.push({ error: `Could not upload file: ${filename}` })
      }
    }

    return res.send({ data: uploads[0]?.url, message: "File uploaded successfully" })
  })

  req.pipe(busboy)
})


export const reencodeVideos = catchAsync(async (_: Request, res: Response) => {
  handleVideoReencoding()
  return res.send({ message: "successfully" })
})
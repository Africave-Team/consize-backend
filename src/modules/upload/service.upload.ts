// import httpStatus from 'http-status'
// import ApiError from '../errors/ApiError'
import { Storage } from '@google-cloud/storage'
import serviceAccount from '../../gcp-details.json'
import { logger } from '../logger'
import ffmpeg from 'fluent-ffmpeg'
import { PassThrough, Readable } from 'stream'
import Blocks from '../courses/model.blocks'
import { MediaType } from '../courses/interfaces.courses'
import path from 'path'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'

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
      logger.info(`${destination} uploaded successfully.`)
      fileStream.end()
      resolve(encodeURI(`https://storage.googleapis.com/kippa-cdn-public/${destination}`))
    })

    fileStream.end(file)
  })
}

export async function streamToBuffer (fileStream: Readable): Promise<Buffer> {
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


// Helper function to get video metadata
export const getVideoMetadata = (filePath: string): Promise<{ video_codec?: string | null | undefined, audio_codec?: string | null | undefined }> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err)
      } else {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video')
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio')

        resolve({
          video_codec: videoStream ? videoStream.codec_name : null,
          audio_codec: audioStream ? audioStream.codec_name : null,
        })
      }
    })
  })
}

// Helper function to re-encode video if necessary
export const reencodeVideo = (inputFilePath: string, outputFilePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFilePath)
      .outputOptions([
        '-vcodec h264',   // Re-encode video using H.264 codec
        '-acodec aac'     // Re-encode audio using AAC codec
      ])
      .save(outputFilePath)
      .on('end', () => {
        console.log(`Video re-encoding completed for ${inputFilePath}`)
        resolve()
      })
      .on('error', (err) => {
        console.error('Error during video re-encoding:', err)
        reject(err)
      })
  })
}



// Helper function to re-encode video if necessary
export const reencodeVideoStream = (inputStream: Readable): Promise<PassThrough> => {
  return new Promise((resolve, reject) => {
    const output = new PassThrough()
    ffmpeg(inputStream)
      .outputOptions([
        '-vcodec h264',   // Re-encode video using H.264 codec
        '-acodec aac'     // Re-encode audio using AAC codec
      ])
      .pipe(output)
      .on('end', () => {
        resolve(output)
      })
      .on('error', (err) => {
        console.error('Error during video re-encoding:', err)
        reject(err)
      })
  })
}




export async function downloadFileToStream (url: string) {
  const storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key?.split(String.raw`\n`).join("\n"),
    },
  })

  const bucketName = 'kippa-cdn-public'
  let [_, destination] = decodeURI(url).split(`/${bucketName}/`)
  if (destination) {
    const file = storage.bucket(bucketName).file(destination)

    // Return the file stream instead of downloading it to disk
    const stream = file.createReadStream()
    console.log(`Streaming ${destination}`)

    return stream
  } else {
    throw new Error("Unable to find file")
  }
}

export async function deleteFile (url: string): Promise<void> {
  const storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key?.split(String.raw`\n`).join("\n"),
    },
  })

  const bucketName = 'kippa-cdn-public'
  let [_, destination] = decodeURI(url).split(`/${bucketName}/`)
  const bucket = storage.bucket(bucketName)
  if (destination) {
    const file = bucket.file(destination)
    await file.delete()
  }


}


export async function downloadFileToDir (url: string, dir: string) {
  const options = {
    destination: dir,
  }
  console.log(options)
  const storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key?.split(String.raw`\n`).join("\n"),
    },
  })

  const bucketName = 'kippa-cdn-public'
  let [_, destination] = decodeURI(url).split(`/${bucketName}/`)
  if (destination) {
    await storage.bucket(bucketName).file(destination).download(options)
    console.log(`Downloaded to ${dir}`)
  }
}

export async function handleVideoReencoding () {
  const projectRoot = process.cwd()
  const localVideoPath = path.join(projectRoot, 'generated-files')
  // const id = 'bcff47ae-b4dc-4a77-b4f6-3768db1c0dcc'
  const blocks = await Blocks.find({
    course: "8822cee4-3557-4207-8c9f-6ef7341dc328", 'bodyMedia.mediaType': MediaType.VIDEO
  })
  if (!existsSync(localVideoPath)) {
    mkdirSync(localVideoPath)
  }
  let destination = 'microlearn-images/'
  await Promise.allSettled(blocks.map(async (block) => {
    if (block.bodyMedia && block.bodyMedia.mediaType === MediaType.VIDEO && block.bodyMedia.url) {
      const bucketName = 'kippa-cdn-public'
      let [_, filename] = decodeURI(block.bodyMedia.url).split(`/${bucketName}/${destination}`)
      if (filename && !filename.includes("reencoded")) {
        if (block.bodyMedia.url.includes("%20")) {
          filename = `${new Date().getTime()}${path.extname(filename)}`
        }
        let original = block.bodyMedia.url
        const outputFileName = `reencoded-${filename}`
        await downloadFileToDir(block.bodyMedia?.url, path.join(localVideoPath, filename))
        await reencodeVideo(path.join(localVideoPath, filename), path.join(localVideoPath, outputFileName))
        const reencodedBuffer = readFileSync(path.join(localVideoPath, outputFileName))
        const url = await uploadFileToCloudStorage(reencodedBuffer, destination + outputFileName)
        block.bodyMedia.url = url
        await block.save()

        await deleteFile(original)
        unlinkSync(path.join(localVideoPath, filename))
        unlinkSync(path.join(localVideoPath, outputFileName))
      }
    }
  }))
}
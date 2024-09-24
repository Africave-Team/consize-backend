// import httpStatus from 'http-status'
// import ApiError from '../errors/ApiError'
import { Storage } from '@google-cloud/storage'
import serviceAccount from '../../gcp-details.json'
import { logger } from '../logger'
import ffmpeg from 'fluent-ffmpeg'

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
};


import { Schema } from 'mongoose'
import { Media, MediaType } from './interfaces.courses'

export const MediaSchema = new Schema<Media>(
  {
    awsFileKey: {
      type: String
    },
    url: {
      type: String,
    },
    mediaType: {
      type: String,
      enum: Object.values(MediaType),
      default: MediaType.IMAGE
    },
    deleted: {
    type: Boolean,
    default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false,
    timestamps: false
  }
)
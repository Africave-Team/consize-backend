import mongoose from 'mongoose'
import validator from 'validator'
import bcrypt from 'bcryptjs'
import toJSON from '../toJSON/toJSON'
import paginate from '../paginate/paginate'
import { IUserDoc, IUserModel } from './user.interfaces'
import { v4 } from 'uuid'
import { IPGDoc, IPGModel } from '../permission-groups/pg.interfaces'

const pgSchema = new mongoose.Schema<IPGDoc, IPGModel>(
  {
    name: {
      type: String
    },
    value: {
      type: String
    },
    permissions: {
      type: Object
    },
    extra: {
      type: Object
    }
  },
  {
    timestamps: false,
    _id: false
  }
)

const userSchema = new mongoose.Schema<IUserDoc, IUserModel>(
  {
    _id: { type: String, default: () => v4() },
    team: {
      type: String,
      ref: "Team"
    },
    avatar: {
      type: String
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate (value: string) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email')
        }
      },
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      validate (value: string) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new Error('Password must contain at least one letter and one number')
        }
      },
      private: true, // used by the toJSON plugin
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    permissionGroup: {
      type: pgSchema
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
    timestamps: true,
    collection: "users"
  }
)

// add plugin that converts mongoose to json
userSchema.plugin(toJSON)
userSchema.plugin(paginate)

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.static('isEmailTaken', async function (email: string, excludeUserId: mongoose.ObjectId): Promise<boolean> {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } })
  return !!user
})

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.method('isPasswordMatch', async function (password: string): Promise<boolean> {
  const user = this
  return bcrypt.compare(password, user.password)
})

userSchema.pre('save', async function (next) {
  const user = this
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 8)
  }
  next()
})

const User = mongoose.model<IUserDoc, IUserModel>('User', userSchema)

export default User

import mongoose from 'mongoose'
import validator from 'validator'
import bcrypt from 'bcryptjs'
import toJSON from '../toJSON/toJSON'
import paginate from '../paginate/paginate'
import { v4 } from 'uuid'
import { IPGDoc, IPGModel } from '../permission-groups/pg.interfaces'
import { IAdminDoc, IAdminModel } from './admin.interfaces'

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

const adminSchema = new mongoose.Schema<IAdminDoc, IAdminModel>(
  {
    _id: { type: String, default: () => v4() },
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
    }
  },
  {
    timestamps: true,
    collection: "administrators"
  }
)

// add plugin that converts mongoose to json
adminSchema.plugin(toJSON)
adminSchema.plugin(paginate)

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
adminSchema.static('isEmailTaken', async function (email: string, excludedId: mongoose.ObjectId): Promise<boolean> {
  const user = await this.findOne({ email, _id: { $ne: excludedId } })
  return !!user
})

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
adminSchema.method('isPasswordMatch', async function (password: string): Promise<boolean> {
  const user = this
  return bcrypt.compare(password, user.password)
})

adminSchema.pre('save', async function (next) {
  const user = this
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 8)
  }
  next()
})

const Administrator = mongoose.model<IAdminDoc, IAdminModel>('Administrator', adminSchema)

export default Administrator

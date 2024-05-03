import httpStatus from 'http-status'
import Token from '../token/token.model'
import ApiError from '../errors/ApiError'
import tokenTypes from '../token/token.types'
import { IAdminDoc, IAdminWithTokens } from './admin.interfaces'
import { generateAuthTokens, verifyToken } from '../token/token.service'
import Administrator from './admin.model'

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<IAdminDoc>}
 */
export const loginUserWithEmailAndPassword = async (email: string, password: string): Promise<IAdminDoc> => {
  const user = await Administrator.findOne({ email })
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Incorrect email or password')
  }
  return user
}

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
export const logout = async (refreshToken: string): Promise<void> => {
  const refreshTokenDoc = await Token.findOne({ token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false })
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found')
  }
  await refreshTokenDoc.deleteOne()
}

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<IAdminWithTokens>}
 */
export const refreshAuth = async (refreshToken: string): Promise<IAdminWithTokens> => {
  try {
    const refreshTokenDoc = await verifyToken(refreshToken, tokenTypes.REFRESH)
    const user = await Administrator.findById(refreshTokenDoc.user)

    if (!user) {
      throw new Error()
    }
    await refreshTokenDoc.deleteOne()
    const tokens = await generateAuthTokens(user)
    return { user, tokens }
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Please authenticate')
  }
}

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
export const resetPassword = async (resetPasswordToken: any, newPassword: string): Promise<void> => {
  try {
    const resetPasswordTokenDoc = await verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD)
    const user = await Administrator.findById(resetPasswordTokenDoc.user)
    if (!user) {
      throw new Error()
    }
    let admin = await Administrator.findOne({ _id: user.id })
    if (admin) {
      admin.password = newPassword
      await admin.save()
    }
    await Token.deleteMany({ user: user.id, type: tokenTypes.RESET_PASSWORD })
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password reset failed')
  }
}

import { IAdminDoc } from './modules/admin/admin.interfaces'
import { IUserDoc } from './modules/user/user.interfaces'

declare module 'express-serve-static-core' {
  export interface Request {
    user: IUserDoc
    admin: IAdminDoc
  }
}

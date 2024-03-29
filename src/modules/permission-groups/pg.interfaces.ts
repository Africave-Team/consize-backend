import { Model, Document } from 'mongoose'
import { QueryResult } from '../paginate/paginate'


export const permissions: Permissions = {
  teams: {
    view: true,
    add: true,
    delete: true
  },
  subscription: {
    view: true,
    add: true,
    delete: true
  },
  certificates: {
    view: true,
    add: true,
    delete: true
  },
  signatories: {
    view: true,
    add: true,
    delete: true
  },
  surveys: {
    view: true,
    add: true,
    delete: true
  },
  students: {
    view: true,
    add: true,
    delete: true
  },
  courses: {
    view: true,
    modify: true,
    add: true,
    delete: true
  },
  dashboard: {
    view: true,
  },

}

export const permissionsCreative: Permissions = {
  certificates: {
    view: true,
    add: true,
    delete: true
  },
  signatories: {
    view: true,
    add: true,
    delete: true
  },
  surveys: {
    view: true,
    add: true,
    delete: true
  },
  students: {
    view: true,
    add: true,
    delete: true
  },
  courses: {
    view: true,
    modify: true,
    add: true,
    delete: true
  },
  dashboard: {
    view: true,
  }
}

export interface Permissions {
  teams?: {
    view: boolean
    add: boolean
    delete: boolean
  }
  subscription?: {
    view: boolean
    add: boolean
    delete: boolean
  }
  certificates?: {
    view: boolean
    add: boolean
    delete: boolean
  }
  signatories?: {
    view: boolean
    add: boolean
    delete: boolean
  }
  surveys?: {
    view: boolean
    add: boolean
    delete: boolean
  }
  students?: {
    view: boolean
    add: boolean
    delete: boolean
  }
  courses?: {
    view: boolean
    modify: boolean
    add: boolean
    delete: boolean
  }
  dashboard?: {
    view: boolean
  }
}

export interface IPG {
  name: string
  value: string
  permissions: Permissions
  extra?: Permissions
}

export interface IPGDoc extends IPG, Document {

}

export interface IPGModel extends Model<IPGDoc> {
  paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<IPGDoc>>
}

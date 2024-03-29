import mongoose from 'mongoose'
import toJSON from '../toJSON/toJSON'
import paginate from '../paginate/paginate'
import { IPGDoc, IPGModel } from './pg.interfaces'
import { v4 } from 'uuid'

const pgSchema = new mongoose.Schema<IPGDoc, IPGModel>(
  {
    _id: { type: String, default: () => v4() },
    name: {
      type: String
    },
    value: {
      type: String
    },
    permissions: {
      type: Object
    }
  },
  {
    timestamps: true,
    collection: "permission-groups"
  }
)

// add plugin that converts mongoose to json
pgSchema.plugin(toJSON)
pgSchema.plugin(paginate)

const PG = mongoose.model<IPGDoc, IPGModel>('PermissionGroups', pgSchema)

export default PG

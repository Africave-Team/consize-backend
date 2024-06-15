import mongoose, { Schema } from 'mongoose';
import { RecycleBinInterface, RecycleBinInterfaceModel } from './recycle-bin.interface';

const recycleBinSchema: Schema = new Schema({
  originalId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  modelName: {
    type: String,
    required: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
});

const RecycleBin: RecycleBinInterfaceModel = mongoose.model<RecycleBinInterface, RecycleBinInterfaceModel>('RecycleBin', recycleBinSchema);

export default RecycleBin;
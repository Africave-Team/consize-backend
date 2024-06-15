import { Model, Document, ObjectId } from 'mongoose';

export interface RecycleBinInterface extends Document {
  originalId: ObjectId;
  modelName: string;
  deletedAt: Date | null;
}

export interface RecycleBinInterfaceModel extends Model<RecycleBinInterface> {}
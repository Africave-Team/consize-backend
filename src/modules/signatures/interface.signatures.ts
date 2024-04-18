import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

export enum SignaturesStatus {
    PENDING = "pending",
    SIGNED = "signed"
}

export interface SignatureInterface extends Document {
    "_id": string,
    "name": string,
    "email": string,
    owner: string
    "position"?: string,
    "signature"?: string,
    "status"?: SignaturesStatus
}

export interface CreateSignatureInterface {
    "name": string,
    "email": string,
    "position": string
}

export interface UpdateSignatureInterface {
    "signature": string,
}

export interface SignatureInterfaceModel extends Model<SignatureInterface> {
    paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<SignatureInterface>>
}
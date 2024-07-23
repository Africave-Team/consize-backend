import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

export enum CertificatesStatus {
    PENDING = "pending",
    ACTIVE = "active",
    DISABLED = "disabled"
}

export interface CertificatesInterface extends Document {
    _id: string,
    template: string,
    teamId: string,
    colors: string[],
    text: string[],
    status: CertificatesStatus,
    signatories: string[]
}

export interface CreateCertificatesInterface {
    template: string,//template name
    colors: string[],
    text: string[],
    status: CertificatesStatus,
    signatories: string[]
}

export interface CertificatesInterfaceModel extends Model<CertificatesInterface> {
    paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<CertificatesInterface>>
}
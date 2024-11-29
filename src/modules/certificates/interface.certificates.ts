import { Document, Model } from 'mongoose'
import { QueryResult } from '../paginate/paginate'

export enum CertificatesStatus {
    PENDING = "pending",
    ACTIVE = "active",
    DISABLED = "disabled"
}

export enum ComponentTypes {
    BACKGROUND = 'background',
    TEXT = "text",
    NAME = "name",
    IMAGE = "image",
    SIGNATORY = "signatory",
    COURSE = "course-title",
    DATE = "date",
    CIRCLE = 'circle',
    TRIANGLE = "triangle",
    TRAPEZOID = "trapezoid",
    SQUARE = 'square',
    RECTANGLE = "rectangle"
}

export enum TextAlign {
    LEFT = "left",
    RIGHT = "right",
    CENTER = "center"
}


export interface ElementProperties {
    height: number | "auto"
    width: number | "auto"
    size: number
    leftSize: number
    rightSize: number
    bottomSize: number
    color: string
    radius: {
        rt: number
        rb: number
        lb: number
        lt: number
    },
    border?: {
        r: number
        b: number
        l: number
        t: number,
        color: string
    },
    text?: {
        size: number
        weight: number
        family: string
        color: string
        value: string
        align: TextAlign
    },

    url?: string
}
export interface CertificateComponent {
    type: ComponentTypes
    position: {
        x: number
        y: number
    },
    properties: Partial<ElementProperties>,
    default?: string
}
export interface CertificateTemplate {
    name?: string
    bg: string
    components: CertificateComponent[]
}

export interface CertificatesInterface extends Document {
    _id: string,
    name: string,
    teamId: string,
    colors: string[],
    text: string[],
    status: CertificatesStatus,
    signatories: string[]
    components: CertificateTemplate
}

export interface CertificatesInterfaceModel extends Model<CertificatesInterface> {
    paginate (filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult<CertificatesInterface>>
}
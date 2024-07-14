import { CertificatesInterface, CreateCertificatesInterface, CertificatesStatus } from './interface.certificates'
import Certificates from "./model.certificates"
import httpStatus from "http-status"
import { ApiError } from '../errors'


export const createCertificate = async ({ template, text, colors, signatories, status  }: CreateCertificatesInterface, teamId: string): Promise<CertificatesInterface> => {
    if (status = CertificatesStatus.ACTIVE) {
        //disable all other certificates for that team
    }

    const certificate = new Certificates({teamId,template,text,colors,signatories,status })
    await certificate.save()
    return certificate
}

export const fetchCertificate = async (certificateId: string): Promise<CertificatesInterface[]> => {
    const certificates = await Certificates.find({ courseId: certificateId })
    return certificates
}

export const deleteCertificate = async (certificateId: string): Promise<void> => {
    await Certificates.deleteOne({ _id: certificateId })
}

export const updateCertificate = async (certificatesPayload: Partial<CreateCertificatesInterface>, id: string): Promise<CertificatesInterface> => {
    const updatedSignature = await Certificates.findByIdAndUpdate(id, { $set: certificatesPayload })
    if (!updatedSignature) throw new ApiError(httpStatus.NOT_FOUND, "Could not find this certificate to update")
    return updatedSignature
}


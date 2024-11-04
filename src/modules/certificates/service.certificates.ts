import { CertificatesInterface } from './interface.certificates'
import Certificates from "./model.certificates"
import httpStatus from "http-status"
import { ApiError } from '../errors'


export const createCertificate = async ({ name, status, signatories }: Pick<CertificatesInterface, "name" | "status" | "signatories">, teamId: string): Promise<CertificatesInterface> => {
    const certificate = new Certificates({ teamId, name, status, signatories })
    await certificate.save()
    return certificate
}

export const fetchCertificate = async (certificateId: string): Promise<CertificatesInterface | null> => {
    const certificates = await Certificates.findById(certificateId).populate("signatories")
    return certificates
}

export const fetchTeamCertificates = async (teamId: string): Promise<CertificatesInterface[]> => {
    const certificates = await Certificates.find({ teamId })
    return certificates
}

export const deleteCertificate = async (certificateId: string): Promise<void> => {
    await Certificates.deleteOne({ _id: certificateId })
}

export const updateCertificate = async (certificatesPayload: Partial<Pick<CertificatesInterface, "name" | "components">>, id: string): Promise<CertificatesInterface> => {
    const updatedSignature = await Certificates.findByIdAndUpdate(id, { $set: certificatesPayload })
    if (!updatedSignature) throw new ApiError(httpStatus.NOT_FOUND, "Could not find this certificate to update")
    return updatedSignature
}


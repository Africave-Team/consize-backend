import { CertificatesInterface } from './interface.certificates'
import Certificates from "./model.certificates"
import httpStatus from "http-status"
import { ApiError } from '../errors'
import { defaultCertificateComponents } from '../utils/constants'
import { Team } from '../teams'



export const createCertificate = async ({ name, status, signatories }: Pick<CertificatesInterface, "name" | "status" | "signatories">, teamId: string): Promise<CertificatesInterface> => {
    try {
        const certificate = new Certificates({ teamId, name, status, signatories, components: defaultCertificateComponents })
        await certificate.save()
        const team = await Team.findById(teamId)
        if (team) {
            if (!team.defaultCertificateId) {
                team.defaultCertificateId = certificate.id
                await team.save()
            }
        }
        return certificate
    } catch (error) {
        console.log(error)
        throw new ApiError(httpStatus.BAD_REQUEST, "Failed to create this certificate")
    }
}

export const duplicateCertificate = async ({ name, id }: Pick<CertificatesInterface, "name" | "id">): Promise<CertificatesInterface> => {
    const oldCertificate = await Certificates.findById(id)
    if (!oldCertificate) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Failed to find this certificate")
    }
    const certificate = new Certificates({ teamId: oldCertificate.teamId, name, status: oldCertificate.status, signatories: oldCertificate.signatories, components: oldCertificate.components })
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


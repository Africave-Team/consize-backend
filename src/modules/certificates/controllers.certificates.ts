import { Request, Response } from "express"
import { catchAsync } from "../utils"
import { certificatesService } from "."
import httpStatus from "http-status"



export const createCertificates = catchAsync(async (req: Request, res: Response) => {
    const cohort = await certificatesService.createCertificate(req.body, req.user.team)
    res.status(httpStatus.CREATED).send({ message: "Certificate created", data: cohort })
})

export const deleteCertificate = catchAsync(async (req: Request, res: Response) => {
    const { cohortId } = req.params
    if (cohortId) {
        await certificatesService.deleteCertificate(cohortId)
    }
    res.status(httpStatus.CREATED).send({ message: "Certificate deleted" })
})



export const getCertificate = catchAsync(async (req: Request, res: Response) => {

    const { certificate } = req.params

    if (certificate) {
        const certificates = await certificatesService.fetchCertificate(certificate)
        res.status(httpStatus.OK).send({ data: certificates })
    } else {
        res.status(404).send({ message: "Certificates not found" })
    }

})

export const updateCertificate = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    if (id) {
        const updatedCertificate = certificatesService.updateCertificate(req.body, id)
        res.status(httpStatus.OK).send({ data: updatedCertificate, message: "certificate updated successfully" })
    }
})
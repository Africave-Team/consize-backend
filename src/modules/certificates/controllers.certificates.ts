import { Request, Response } from "express"
import { catchAsync } from "../utils"
import { certificatesService } from "."
import httpStatus from "http-status"



export const createCertificates = catchAsync(async (req: Request, res: Response) => {
    const cohort = await certificatesService.createCertificate(req.body, req.user.team)
    res.status(httpStatus.CREATED).send({ message: "Certificate created", data: cohort })
})

export const deleteCertificate = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    if (id) {
        await certificatesService.deleteCertificate(id)
    }
    res.status(httpStatus.CREATED).send({ message: "Certificate deleted" })
})



export const getCertificates = catchAsync(async (req: Request, res: Response) => {
    const certificates = await certificatesService.fetchTeamCertificates(req.user.team)
    res.status(httpStatus.OK).send({ data: certificates })
})

export const updateCertificate = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    if (id) {
        const updatedCertificate = await certificatesService.updateCertificate(req.body, id)
        res.status(httpStatus.OK).send({ data: updatedCertificate, message: "certificate updated successfully" })
    }
})

export const duplicateCertificate = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    if (id) {
        const updatedCertificate = await certificatesService.duplicateCertificate({ id, name: req.body.name })
        res.status(httpStatus.OK).send({ data: updatedCertificate, message: "certificate duplicated successfully" })
    }
})
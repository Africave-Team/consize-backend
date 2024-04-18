import httpStatus from "http-status"
import { signatureService } from "."
import { catchAsync } from "../utils"
import { Request, Response } from "express"
import { emailService } from '../email'
import { tokenService, tokenTypes } from "../token"
import moment from "moment"
import config from '../../config/config'
import { teamService } from "../teams"


export const createSignature = catchAsync(async (req: Request, res: Response) => {
    const { name, email, position } = req.body
    const signatures = await signatureService.createSignature({ name: name, email: email, position }, req.user.team)
    const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes')
    const token = await tokenService.generateToken(req.user.id, accessTokenExpires, tokenTypes.ACCESS)
    const team = await teamService.fetchTeamById(req.user.team)
    await emailService.sendSignatureNotificationEmail(email, name.split(' ')[0], team?.name || "", token, signatures.id)
    res.status(httpStatus.OK).send({ data: signatures, message: "signatory details created and notification mail sent to the signatory" })
})

export const fetchSignatories = catchAsync(async (req: Request, res: Response) => {
    const results = await signatureService.fetchSignatures(req.user.team)
    res.status(httpStatus.OK).send({ data: results, message: "Your signatories" })
})

export const updateSignature = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    if (id) {
        const updatedSignature = signatureService.updateSignature(req.body, id)
        res.status(httpStatus.OK).send({ data: updatedSignature, message: "signature updated successfully" })
    }
})
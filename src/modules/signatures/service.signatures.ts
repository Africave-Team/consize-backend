import { CreateSignatureInterface, SignatureInterface, UpdateSignatureInterface } from "./interface.signatures"
import Signatures from "./model.signatures"
import { ApiError } from '../errors'
import httpStatus from 'http-status'


export const createSignature = async (signaturePayload: CreateSignatureInterface, teamId: string): Promise<SignatureInterface> => {
    const signature = new Signatures({ ...signaturePayload, owner: teamId })
    await signature.save()
    return signature
}

export const fetchSignatures = async (owner: string): Promise<SignatureInterface[]> => {
    return Signatures.find({ owner })
}



export const updateSignature = async (signaturePayload: Partial<UpdateSignatureInterface>, id: string): Promise<SignatureInterface> => {
    const updatedSignature = await Signatures.findByIdAndUpdate(id, { $set: signaturePayload })
    if (!updatedSignature) throw new ApiError(httpStatus.NOT_FOUND, "Could not find this signature to update")
    return updatedSignature
}
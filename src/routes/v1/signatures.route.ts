import express, { Router } from "express";
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { signatureControllers, signaturesValidator } from "../../modules/signatures/";


const router: Router = express.Router();
router.use(auth());

router.post('/', validate(signaturesValidator.createSignature),signatureControllers.createSignature)
router.put('/:id', validate(signaturesValidator.updateSignature), signatureControllers.updateSignature)

export default router
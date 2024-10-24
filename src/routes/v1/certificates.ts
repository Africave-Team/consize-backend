import express, { Router } from "express"
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { certificatesControllers, certificatesValidator } from "../../modules/certificates/"


const router: Router = express.Router()
router.use(auth())

router.post('/', validate(certificatesValidator.createCertificates), certificatesControllers.createCertificates)
router.get('/', certificatesControllers.getCertificates)
router.put('/:id', validate(certificatesValidator.updateCertificates), certificatesControllers.updateCertificate)

export default router
import express, { Router } from "express"
import { validate } from '../../modules/validate'
import { auth } from '../../modules/auth'
import { certificatesControllers, certificatesValidator } from "../../modules/certificates/"


const router: Router = express.Router()
router.route('/open/:id')
  .get(certificatesControllers.getCertificateById)
router.use(auth())

router.post('/', validate(certificatesValidator.createCertificates), certificatesControllers.createCertificates)
router.get('/', certificatesControllers.getCertificates)
router.route('/:id')
  .get(certificatesControllers.getCertificateById)
  .put(validate(certificatesValidator.updateCertificates), certificatesControllers.updateCertificate)
  .post(certificatesControllers.duplicateCertificate)
  .delete(certificatesControllers.deleteCertificate)

export default router
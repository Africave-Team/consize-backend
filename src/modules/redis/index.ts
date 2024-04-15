import * as redis from 'redis'
import config from '../../config/config'
import { logger } from '../logger'
const redisClient = redis.createClient({
  url: config.redis
}).on('error', err => logger.info('Redis Client Error', err)).on('connect', () => logger.info('Redis Client connected', `${config.redis}`))
redisClient.connect()
export { redisClient }


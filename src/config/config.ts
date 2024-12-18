import Joi from 'joi'
import 'dotenv/config'

const envVarsSchema = Joi.object()
  .keys({
    ENV: Joi.string().required(),
    VERCEL_AUTH_TOKEN: Joi.string().required(),
    FACEBOOK_APP_ID: Joi.string().required(),
    WABA_ID: Joi.string().required(),
    FACEBOOK_APP_SECRET: Joi.string().required(),
    FACEBOOK_REDIRECT_URI: Joi.string().required(),
    OPENAI_API_KEY: Joi.string().required(),
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    REDIS_HOST: Joi.string().required().description('REDIS Host url'),
    REDIS_PASSWORD: Joi.string().required().description('REDIS password'),
    REDIS_PORT: Joi.string().required().description('REDIS port'),
    WHATSAPP_PHONENUMBER_ID: Joi.string().required().description("phone number ID for whatsapp"),
    WHATSAPP_AUTH_TEMPLATE_NAME: Joi.string().required().description("Authentication template for first time student enrollment"),
    REDIS_BASE_KEY: Joi.string().required().description("Base key string for redis store"),
    WHATSAPP_TOKEN: Joi.string().required().description("Whatsapp api token"),
    PORT: Joi.number().default(3000),
    FACEBOOK_SECRET: Joi.string().required().description("Facebook subscription key"),
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which reset password token expires'),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which verify email token expires'),
    SMTP_HOST: Joi.string().description('server that will send the emails'),
    SMTP_PORT: Joi.number().description('port to connect to the email server'),
    SMTP_USERNAME: Joi.string().description('username for email server'),
    SMTP_PASSWORD: Joi.string().description('password for email server'),
    EMAIL_FROM: Joi.string().description('the from field in the emails sent by the app'),
    CLIENT_URL: Joi.string().required().description('Client url'),
    SLACK_CLIENT_ID: Joi.string().required().description("Provide slack credentials"),
    SLACK_APP_SECRET: Joi.string().required().description("Provide slack credentials"),
    SLACK_REDIRECT_URI: Joi.string().required().uri().description("redirect uri for slack. must be a uri")
  })
  .unknown()

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

const config = {
  env: envVars.NODE_ENV,
  server: envVars.ENV,
  port: envVars.PORT,
  vercelToken: envVars.VERCEL_AUTH_TOKEN,
  whatsapp: {
    authTemplateName: envVars.WHATSAPP_AUTH_TEMPLATE_NAME,
    subscriptionKey: envVars.FACEBOOK_SECRET,
    token: envVars.WHATSAPP_TOKEN,
    phoneNumberId: envVars.WHATSAPP_PHONENUMBER_ID,
    waba: envVars.WABA_ID
  },
  openAI: {
    key: envVars.OPENAI_API_KEY
  },
  whatsappSubscriptionKey: envVars.FACEBOOK_SECRET,
  whatsappToken: envVars.WHATSAPP_TOKEN,
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
    cookieOptions: {
      httpOnly: true,
      secure: envVars.NODE_ENV === 'production',
      signed: true,
    },
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
  redis: {
    host: envVars.REDIS_HOST,
    password: envVars.REDIS_PASSWORD,
    port: envVars.REDIS_PORT
  },
  redisBaseKey: envVars.REDIS_BASE_KEY,
  clientUrl: envVars.CLIENT_URL,
  slack: {
    id: envVars.SLACK_CLIENT_ID,
    secret: envVars.SLACK_APP_SECRET,
    redirectUrl: envVars.SLACK_REDIRECT_URI
  },
  facebook: {
    id: envVars.FACEBOOK_APP_ID,
    secret: envVars.FACEBOOK_APP_SECRET,
    redirectUrl: envVars.FACEBOOK_REDIRECT_URI
  }
}

export default config

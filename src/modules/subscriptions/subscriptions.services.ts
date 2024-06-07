import httpStatus from 'http-status'
import { PeriodTypes } from '../courses/interfaces.settings'
import { ApiError } from '../errors'
import { PlanPeriods, SubscriptionPlan, SubscriptionPlanInterface } from './plans.interfaces'
import SubscriptionPlans from './plans.model'
import { SubscribePayload, SubscriptionInterface, SubscriptionStatus } from './subscriptions.interfaces'
import moment from 'moment'
import Subscriptions from './subscriptions.models'
import { agenda } from '../scheduler'
import { HANDLE_SUBSCRIPTION_TERMINATION, HANDLE_SUBSCRIPTION_GRACE_PERIOD_TERMINATION, SEND_SUBSCRIPTION_TERMINATION_EMAIL, SEND_SUBSCRIPTION_GRACE_PERIOD_EMAIL } from '../scheduler/MessageTypes'
import Teams from '../teams/model.teams'
import { User } from '../user'
import { SEND_VERIFICATION_MESSAGE } from '../scheduler/jobs/sendMessage'

export const handleTerminateSubscription = async (subscriptionId: string) => {
  console.log(subscriptionId)
  let subscription = await Subscriptions.findById(subscriptionId).populate("plan")
  if (subscription) {
    let plan: SubscriptionPlan | null = null
    if (typeof subscription.plan === "object") {
      plan = subscription.plan as SubscriptionPlan
    }

    if (plan) {
      if (plan.gracePeriod && plan.gracePeriod.value > 0) {
        let period = moment().add(plan.gracePeriod.value, plan.gracePeriod.period)
        agenda.schedule<{ subscriptionId: string }>(period.toDate(), HANDLE_SUBSCRIPTION_GRACE_PERIOD_TERMINATION, { subscriptionId })
        let team = await Teams.findById(subscription.owner)
        if (team) {
          let user = await User.findById(team.owner)
          if (user) {
            // send email to team
            agenda.now<Partial<SEND_VERIFICATION_MESSAGE>>(SEND_SUBSCRIPTION_GRACE_PERIOD_EMAIL, { name: user.name, email: user.email, duration: `${plan.gracePeriod.value} ${plan.gracePeriod.period}` })
          }
        }
        await Subscriptions.findByIdAndUpdate(subscriptionId, { status: SubscriptionStatus.GRACE })
      } else {
        handleTerminateSubscriptionGracePeriod(subscriptionId)
      }
    }
  }
}

export const handleTerminateSubscriptionGracePeriod = async (subscriptionId: string) => {
  let subscription = await Subscriptions.findById(subscriptionId)
  if (subscription) {
    let team = await Teams.findById(subscription.owner)
    if (team) {
      let user = await User.findById(team.owner)
      if (user) {
        // send email to team
        agenda.now<Partial<SEND_VERIFICATION_MESSAGE>>(SEND_SUBSCRIPTION_TERMINATION_EMAIL, { name: user.name, email: user.email })
      }
    }

    await Subscriptions.findByIdAndUpdate(subscriptionId, { status: SubscriptionStatus.INACTIVE })
  }
}

export const seedSubscriptionPlans = async function () {
  const plans: SubscriptionPlan[] = [
    {
      name: "Free trial",
      price: 0,
      disabled: false,
      description: "Enjoy a free trial of our service with access to basic features for one month. No credit card required. Cancel anytime.",
      period: PlanPeriods.MONTHLY,
      gracePeriod: {
        value: 4,
        period: PeriodTypes.DAYS
      }
    },
    {
      name: "Paid subscription",
      price: 30000,
      disabled: false,
      description: "Unlock all premium features with our paid subscription. Enjoy uninterrupted service with monthly billing. Includes priority support and access to exclusive content.",
      period: PlanPeriods.MONTHLY
    }
  ]


  for (let plan of plans) {
    await SubscriptionPlans.updateOne({ name: plan.name }, plan, { upsert: true })
  }
}

export const fetchSubscriptionPlans = async (): Promise<SubscriptionPlanInterface[]> => {
  const plans = await SubscriptionPlans.find({})
  return plans
}

export const fetchSubscriptionPlanById = async (id: string) => SubscriptionPlans.findById(id)

export const fetchMyActiveSubscription = async function (owner: string): Promise<SubscriptionInterface | null> {
  const subscription = await Subscriptions.findOne({
    owner,
    $or: [{ status: SubscriptionStatus.ACTIVE }, { status: SubscriptionStatus.GRACE }]
  }).populate('plan')
  return subscription
}

export const subscribeClient = async function (payload: SubscribePayload, owner: string): Promise<SubscriptionInterface> {
  const plan = await SubscriptionPlans.findById(payload.planId)
  if (!plan) {
    throw new ApiError(httpStatus.NOT_FOUND, "Could not find this plan and so we could not create your subscription")
  }
  if (plan.price === 0) {
    // free plan
    const existing = await Subscriptions.find({ plan: payload.planId, owner })
    if (existing.length > 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Your free trial subscription has already ended.")
    }
  }
  const expiration = moment().add(payload.numberOfMonths, "months").endOf("day")
  const subscription = await Subscriptions.create({
    owner,
    plan: payload.planId,
    status: SubscriptionStatus.ACTIVE,
    expires: expiration.toDate()
  })
  // schedule the unsubscribe event for payload.numberOfMonths into the future
  agenda.schedule<{ subscriptionId: string }>(expiration.toDate(), HANDLE_SUBSCRIPTION_TERMINATION, { subscriptionId: subscription.id })
  return subscription
}
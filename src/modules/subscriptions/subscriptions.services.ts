import { PeriodTypes } from '../courses/interfaces.settings'
import { PlanPeriods, SubscriptionPlan } from './plans.interfaces'
import SubscriptionPlans from './plans.model'

export const handleTerminateSubscription = async (subscriptionId: string) => {
  console.log(subscriptionId)
}

export const handleTerminateSubscriptionGracePeriod = async (subscriptionId: string) => {
  console.log(subscriptionId)
}

export const seedSubscriptionPlans = async function () {
  const plans: SubscriptionPlan[] = [
    {
      name: "Free trial",
      price: 0,
      disabled: false,
      description: "",
      period: PlanPeriods.MONTHLY,
      gracePeriod: {
        value: 4,
        period: PeriodTypes.DAYS
      }
    },
    {
      name: "Paid subscription",
      price: 0,
      disabled: false,
      description: "",
      period: PlanPeriods.MONTHLY
    }
  ]

  for (let plan of plans) {
    await SubscriptionPlans.create(plan)
  }
}

export const fetchSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  const plans = await SubscriptionPlans.find({})
  return plans
}
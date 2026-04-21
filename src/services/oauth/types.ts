/**
 * OAuth types for authentication flows.
 */

export type SubscriptionType = 'max' | 'pro' | 'enterprise' | 'team' | (string & {})

export type BillingType = string

export type RateLimitTier = string

export type OAuthTokenExchangeResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

export type OAuthProfileResponse = {
  account: {
    uuid: string
    email: string
    display_name?: string
    created_at?: string
  }
  organization: {
    uuid: string
    organization_type?: string
    has_extra_usage_enabled?: boolean
    billing_type?: BillingType
    subscription_created_at?: string
    rate_limit_tier?: RateLimitTier
  }
}

export type OAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  scopes?: string[]
  subscriptionType?: SubscriptionType | null
  profile?: OAuthProfileResponse
  tokenAccount?: {
    uuid: string
    emailAddress: string
    organizationUuid?: string
  }
}

export type UserRolesResponse = {
  roles?: string[]
  [key: string]: unknown
}

export type ReferralCampaign = 'claude_code_guest_pass' | (string & {})

export type ReferralEligibilityResponse = {
  eligible: boolean
  referral_code_details?: {
    referral_link?: string
    campaign?: string
  }
  referrer_reward?: ReferrerRewardInfo | null
}

export type ReferrerRewardInfo = {
  [key: string]: unknown
}

export type ReferralRedemptionsResponse = {
  redemptions?: Array<{
    [key: string]: unknown
  }>
  [key: string]: unknown
}

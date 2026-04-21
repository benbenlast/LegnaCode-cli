/**
 * Feedback survey utility types.
 */

export type FeedbackSurveyResponse = 'dismissed' | 'bad' | 'fine' | 'good'

export type FeedbackSurveyType = 'session' | 'compact' | 'memory' | (string & {})

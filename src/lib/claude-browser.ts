// Photo analysis for the browser build (no main process). The key never leaves
// this device except to api.anthropic.com.
import Anthropic from '@anthropic-ai/sdk'
import prompt from '../../shared/meal-prompt.json'
import type { MealAnalysis } from './types'

export async function analyzeWithClaude(a: { apiKey: string; imageBase64: string; mediaType: string; model: string; note?: string }): Promise<MealAnalysis> {
  const client = new Anthropic({ apiKey: a.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 120_000 })
  const response = await client.beta.messages.create({
    // Typed meals are simple; a faster model at low effort keeps them cheap.
    model: a.imageBase64 ? a.model || 'claude-opus-5-5' : 'claude-sonnet-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: prompt.system,
    output_config: { effort: a.imageBase64 ? 'medium' : 'low', format: { type: 'json_schema', schema: prompt.schema } },
    messages: [{
      role: 'user',
      content: a.imageBase64 ? [
        { type: 'image', source: { type: 'base64', media_type: a.mediaType as 'image/jpeg', data: a.imageBase64 } },
        { type: 'text', text: a.note ? `Context from the user: ${a.note}` : 'Estimate this meal.' },
      ] : [{ type: 'text', text: `No photo. The user typed: ${a.note ?? ''}` }],
    }],
  })
  if (response.stop_reason === 'refusal') throw new Error('The model declined to analyze this meal.')
  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  return JSON.parse(text) as MealAnalysis
}

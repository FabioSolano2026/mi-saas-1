/**
 * ai-provider.ts
 *
 * Proveedor de IA centralizado.
 * Usa OpenRouter si OPENROUTER_API_KEY está disponible,
 * sino cae a OpenAI directo con OPENAI_API_KEY.
 *
 * IMPORTANTE: En AI SDK v6, provider(model) usa el Responses API de OpenAI por defecto.
 * Para OpenRouter (que no soporta Responses API) usar provider.chat(model).
 */

import { createOpenAI } from '@ai-sdk/openai'

const useOpenRouter = !!process.env.OPENROUTER_API_KEY

const _provider = useOpenRouter
  ? createOpenAI({
      baseURL:       'https://openrouter.ai/api/v1',
      apiKey:        process.env.OPENROUTER_API_KEY!,
      compatibility: 'compatible',
    })
  : createOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })

// Modelos por tarea
export const MODELS = {
  chat:      useOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
  embedding: useOpenRouter ? 'openai/text-embedding-3-small' : 'text-embedding-3-small',
} as const

// chatModel: usa .chat() para forzar Chat Completions API (compatible con OpenRouter)
// Cuando useOpenRouter=false, OpenAI directo sí soporta el Responses API
export const chatModel = useOpenRouter
  ? _provider.chat(MODELS.chat)
  : _provider(MODELS.chat)

// Para embeddings el provider base es suficiente
export const aiProvider = _provider

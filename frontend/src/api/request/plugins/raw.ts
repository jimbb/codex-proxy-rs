import type { RequestContext, RequestNext } from './index'
import { t } from '@/i18n'
import { ApiError, normalizeApiResponseError } from './error'

export interface RawResponseMeta {
  status: number
  header: (name: string) => string | undefined
}

export interface RawResponse {
  status: number
  contentType: string
  body: ArrayBuffer
}

export interface RawResponseOptions {
  maximumBytes: number
  accept: (response: RawResponseMeta) => boolean
}

export async function rawPlugin(context: RequestContext, next: RequestNext) {
  const options = context.raw
  if (!options)
    return next()
  context.config = {
    ...context.config,
    responseType: 'arraybuffer',
    validateStatus: () => true,
  }
  const response = await next()
  const body = response.data as ArrayBuffer
  const meta: RawResponseMeta = {
    status: response.status,
    header: name => rawHeader(response.headers, name),
  }
  if (options.accept(meta)) {
    if (body.byteLength > options.maximumBytes)
      throw new ApiError(t('common.errors.responseTooLarge'), 502, undefined, rawHeader(response.headers, 'x-request-id'), 'http')
    return {
      ...response,
      data: {
        status: response.status,
        contentType: rawHeader(response.headers, 'content-type') ?? 'application/octet-stream',
        body,
      } satisfies RawResponse,
    }
  }

  const decoded = decodeRawEnvelope(body)
  const normalized = normalizeApiResponseError({ ...response, data: decoded })
  if (normalized)
    throw normalized
  throw new ApiError(
    response.status >= 400 ? t('common.errors.http', { status: response.status }) : t('common.errors.unsupportedResponse'),
    response.status,
    undefined,
    rawHeader(response.headers, 'x-request-id'),
    'http',
  )
}

function rawHeader(headers: unknown, name: string) {
  if (!headers || typeof headers !== 'object')
    return undefined
  const source = headers as { get?: (key: string) => unknown, [key: string]: unknown }
  const value = typeof source.get === 'function' ? source.get(name) : source[name]
  return typeof value === 'string' && value ? value : undefined
}

function decodeRawEnvelope(body: ArrayBuffer): unknown {
  if (body.byteLength === 0)
    return undefined
  try {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(body))) as unknown
  }
  catch {
    return undefined
  }
}

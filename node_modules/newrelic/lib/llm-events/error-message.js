/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Represents an error object, to be tracked via `agent.errors`, that is the
 * result of some error returned from LLM operations.
 */
module.exports = class LlmErrorMessage {
  /**
   * @param {object} params Constructor parameters
   * @param {object} params.response Instance of an incoming message.
   * @param {object} params.cause An instance of the LLM error object.
   * @param {LlmChatCompletionSummary} [params.summary] Details about the
   * conversation if it was a chat completion conversation.
   * @param {LlmEmbedding} [params.embedding] Details about the conversation
   * if it was an embedding conversation.
   * @param {LlmVectorStoreSearch} [params.vectorsearch] Details about the vector
   * search if it was a vector search event.
   * @param {LlmTool} [params.tool] Details about the tool event if it was a tool event.
   * @param {object} [params.aiAgent] Details about the AI agent event if it was an AI agent event.
   */
  constructor({ response, cause, summary = {}, embedding = {}, vectorsearch = {}, tool = {}, aiAgent = {} } = {}) {
    this['http.statusCode'] = response?.statusCode ?? response?.status ?? cause?.status
    this['error.message'] = cause?.message
    this['error.code'] = response?.code ?? cause?.error?.code ?? cause?.code ?? cause?.cause?.code
    this['error.param'] = response?.param ?? cause?.param ?? cause?.error?.param
    this.completion_id = summary?.id
    this.embedding_id = embedding?.id
    this.vector_store_id = vectorsearch?.id
    this.tool_id = tool?.id
    this.agent_id = aiAgent?.id
  }

  get [Symbol.toStringTag]() {
    return 'LlmErrorMessage'
  }
}

/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmErrorMessage = require('../error-message')

/**
 * LangChain-specific LLM error message.
 * Uses `cause.lc_error_code` as the error code when present.
 *
 * @augments LlmErrorMessage
 */
module.exports = class LangChainLlmErrorMessage extends LlmErrorMessage {
  constructor(params = {}) {
    super(params)
    if (params.cause?.['lc_error_code']) {
      this['error.code'] = params.cause['lc_error_code']
    }
  }
}

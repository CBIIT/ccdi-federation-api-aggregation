/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const InstrumentationDescriptor = require('../../instrumentation-descriptor')

const instrumentations = [
  {
    type: InstrumentationDescriptor.TYPE_CONGLOMERATE,
    moduleName: 'aws-sdk',
    onRequire: require('./v2/instrumentation')
  }
]

module.exports = instrumentations

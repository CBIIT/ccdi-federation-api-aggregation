/*
Copyright (c) 2025, FNLCR - All rights reserved.
*/
const https = require('https');
const axios = require('axios');
const errCpiServerError = '{"errors": [{"kind": "NotFound", "method": "GET", "route": "/subject-mapping", "message":"Server Error."}]}';
//namespaceDeposGatewaysData is a format example of parseSubjectIds result
const namespaceDeposGatewaysData =   [{
    namespace: { organization: 'MyOrg1', name: 'sd-123' },
    name: 'gh-123',
    depositions: [ { kind: 'dbGaP', value: 'phs001234' } ],
    gateways: [{ kind: 'Reference', gateway: 'org1-gateway' }]
  }];
//cpiInputLoad is an example of CPI request data extracted from API subject response
const cpiInputLoad = [
    { domain_name: 'MyOrg1', participant_id: 'gh-123' },
    { domain_name: 'sd-123', participant_id: 'gh-123' },
    { domain_name: 'phs001234', participant_id: 'gh-123' },
    { domain_name: 'org1-gateway', participant_id: 'gh-123' }
  ];
//requestBodyCpi is an example of CPI PID request body
const requestBodyCpi = {
    participant_ids: [
        { domain_name: "USI", participant_id: "PAKZVD" }
    ]
};
const invalidToken = "___invalid___";
//CPI requests configuration
const clientId = process.env.cpi_client_id;
const clientSecret = process.env.cpi_client_secret;
const tokenUrl = process.env.cpi_token_url;
const cpiUrl = process.env.cpi_url;
const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
//postDataRequestToken is CPI token body data
const postDataRequestToken = JSON.stringify({
  grant_type: 'client_credentials',
  scope: 'custom'
});
axios.defaults.timeout = 15000;
//optionsToken is CPI token request options
const optionsToken = {
  host: tokenUrl,
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  },
  rejectUnauthorized: false
};
// console.debug("debug", JSON.stringify(optionsToken));
//strCpiMock is mock CPI response data 
const strCpiMock = JSON.stringify({supplementary_domains: [], participant_ids: 
  [
    {domain_name: "USI", participant_id: "PADJKU", 
    associated_ids: [{participant_id: " PADJKU", domain_name: "USI", domain_category: "organizational_identifier"}]}, 
    {domain_name: "USI", participant_id: "PAKZVD", 
    associated_ids: [{participant_id: "COG_PAKZVD", 
    domain_name: "PCDC", domain_category: "organizational_identifier"}, 
    {participant_id: " PAKZVD", domain_name: "USI", domain_category: "organizational_identifier"}]}
  ]}
);

var isCpiActivated = false;
function cpiInit() {
    isCpiActivated = true;
    if (! clientId) {
        console.error("error", "cpi_client_id environment variable not defined");
        isCpiActivated = false;
    }
    if (! clientSecret) {
        console.error("error", "cpi_client_secret environment variable not defined");
        isCpiActivated = false;
    }
    if (! tokenUrl) {
        isCpiActivated = false;
        console.error("error", "cpi_token_url environment variable not defined");
    }
    if (! cpiUrl) {
        isCpiActivated = false;
        console.error("error", "cpi_url environment variable not defined");
    }
    console.info("info", "cpiUtils cpi access is configured", isCpiActivated);
};
function isCpiConfigured() {
    return isCpiActivated;
}
/*
data is a string AL response subject entity response format.
const namespaceDeposGatewaysData is an example of the object output.
*/
function parseSubjectIds(data) {
    return extractIdFromData(JSON.parse(data));
}
function extractIdFromData(data) {
    const result = [];

    // Iterate over the array
    data.forEach(item => {
      if (item.data && Array.isArray(item.data)) {
        // Iterate over the "data" array to find "id" and "metadata.depositions" objects
        item.data.forEach(dataItem => {
          if ((dataItem.id) && dataItem.kind === 'Participant') {
            // Create a new object with the id and merge it with "depositions" from metadata
            const extractedData = { ...dataItem.id };
  
            // If "metadata.depositions" exists, merge it with the extracted data
            if (dataItem.metadata && dataItem.metadata.depositions) {
              extractedData.depositions = dataItem.metadata.depositions;
            }
            if (dataItem.gateways && Array.isArray(dataItem.gateways)) {
              extractedData.gateways = dataItem.gateways;
            } 
            result.push(extractedData); // Push the merged object into the result array
          }
        });
      }
    });
    return result;
  };
/*
requestBodyCpi is a return format example
*/
function generateCpiRequestBody(data) {
  const result = [];
  // Iterate over the array
  data.forEach(item => {
      // Iterate over the "data" array to find "id" and "metadata.depos" objects
          if (item.namespace) {
          // Create a new object with the id and merge it with "depos" from metadata
          let tmp = {domain_name: item.namespace.organization, participant_id: item.name};
          result.push(tmp);
          tmp = {domain_name: item.namespace.name, participant_id: item.name};
          result.push(tmp);
          // If "metadata.depos" exists, merge it with the extracted data
          if (item.depositions && Array.isArray(item.depositions)) {
              // Iterate over depos array
              item.depositions.forEach(deposItem => {
              tmp = {domain_name: deposItem.value, participant_id: item.name};
              result.push(tmp); // Push into the result array
              });
          }
          if (item.gateways && Array.isArray(item.gateways)) {
              // Iterate over depos array
              item.gateways.forEach(gatewayItem => {
              tmp = {domain_name: gatewayItem.gateway, participant_id: item.name};
              result.push(tmp); // Push into the result array
              });
          }
          }
  });
  let loadData = {participant_ids: result};
  //console.debug("debug", "generateCpiBody result\n", loadData);
  return loadData;
};

//apiToCpi returns JSON response string Promise
async function apiToCpi(apiSubjectData) {
  if (! isCpiConfigured()) {
    console.error("error", "API CPI communication is not configured");
    return errCpiServerError;
  }
  // Get token
  let currToken = invalidToken;
  try {
    currToken = await getAccessToken();
    // console.debug("debug", "currToken success", currToken);
    if (currToken !== invalidToken) {
      //Send a request and collect a response
      var cpiIds = generateCpiRequestBody(parseSubjectIds(apiSubjectData));
      // start CPI request workflow
      console.info("info IDs sent to CPI", JSON.stringify(cpiIds));
      var cpiResponse = await getCPIRequest(currToken, cpiIds);
      //var cpiResponse = await getCPIRequest(currToken, requestBodyCpi);//this is a sample data to send to CPI
      //console.debug("debug typeof cpiResponse", (typeof cpiResponse), "API response:\n", cpiResponse);
      return cpiResponse;
      //return strCpiMock;//this is a sample data to return from CPI
    }
    else {
      //when no token return a prepared error JSON
      console.error("error no token in API to CPI workflow", error);
      return errCpiServerError;
    }
  } catch (error) {
    console.error("error in API to CPI workflow", error);
    return errCpiServerError;
  }
}
// We assume at this fucntion that CPI is configured
async function getAccessToken() {
    try {
        const payload = "grant_type=client_credentials&scope=custom";
 
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
 
        const response = await axios.post(tokenUrl, payload, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 15000,
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
        });
 
        if (response.status === 200) {
            const accessToken = response.data.access_token;
            //console.debug(`debug: Access Token ${accessToken}`);
            return accessToken;
        } else {
           console.error("error", `failed request to get access token: ${response.status} - ${response.statusText}`);
           return invalidToken;
        }
    } catch (error) {
      console.error("error", `in getting access token: ${error.message}`);
      return invalidToken;
    }
}
async function getCPIRequest(accessToken, requestBody) {
    try {
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
 
        //console.debug("debug: CPI Headers", headers);
        //console.debug("debug: CPI Request Body", requestBody);
 
        const response = await axios.get(cpiUrl, {
            headers,
            timeout: 15000,
            data: requestBody, // axios GET doesn't support json, so we use object instead
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
        });
 
        //console.debug("debug", "CPI Response Code", response.status);
        //console.debug("debug", "CPI Response data", response.data);
 
        if (response.status === 200) {
          //console.debug("debug response.data type", (typeof response.data));
          return response.data;
        } else {
            console.error(`error API request failed: ${response.status} - ${response.statusText}`);
            return errCpiServerError;
        }
    } catch (error) {
        console.error(`error making API request: ${error.message}`);
        return errCpiServerError;
    }
}
module.exports = {
    parseSubjectIds,
    generateCpiRequestBody,
    isCpiConfigured,
    cpiInit,
    apiToCpi
}
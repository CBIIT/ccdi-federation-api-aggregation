/*
Copyright (c) 2025, FNLCR - All rights reserved.
*/
const axios = require('axios');
const errCpiServerError = JSON.parse('{"errors": [{"kind": "NotFound", "method": "GET", "route": "/subject-mapping", "message":"Server Error."}]}');
const errCpiNotFound = JSON.parse('{"errors": [{"kind": "NotFound", "method": "GET", "route": "/subject-mapping", "message":"Participants IDs are not found."}]}');
//namespaceDeposGatewaysData is a format example of parseSubjectIds result
const namespaceDeposGatewaysData =   [{
    namespace: { organization: 'MyOrg1', name: 'sd-123' },
    name: 'gh-123',
    depositions: [ { kind: 'dbGaP', value: 'phs001234' } ],
    gateways: [{ kind: 'Reference', gateway: 'org1-gateway' }]
  }];
//namespaceDeposGatewaysData is a format example of parseSourceSubjectIds result
const nameSourceData = [{
    source: "api-server",
    name: 'gh-123',
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

axios.defaults.timeout = 15000;

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
function checkArrayLength(obj, attribute) {
  if (obj && obj.hasOwnProperty(attribute) && Array.isArray(obj[attribute])) {
    return (obj[attribute].length > 0);
  } else {
    return false; 
  }
}
var isCpiActivated = false;
function cpiInit() {
    isCpiActivated = true;
    if (! clientId) {
      isCpiActivated = false;
      //console.error("error", "cpi_client_id environment variable not defined");
      let outputMsgResp = {level: "error", server: "resource", note: "cpi_client_id environment variable not defined"};
      console.error(JSON.stringify(outputMsgResp));
    }
    else {
      //console.info("info", "cpi_client_id environment variable is defined as", clientId);
      let outputMsgResp = {level: "info", server: "resource", note: "cpi_client_id environment variable " + clientId};
      console.info(JSON.stringify(outputMsgResp));
    }
    if (! clientSecret) {
      isCpiActivated = false;
      //console.error("error", "cpi_client_secret environment variable not defined");
      let outputMsgResp = {level: "error", server: "resource", note: "cpi_client_secret environment variable not defined"};
      console.error(JSON.stringify(outputMsgResp));
    }
    else {
      //console.info("info", "cpi_client_secret environment variable is defined");
      let outputMsgResp = {level: "info", server: "resource", note: "cpi_client_secret environment variable is defined"};
      console.info(JSON.stringify(outputMsgResp));
    }
    if (! tokenUrl) {
      isCpiActivated = false;
      //console.error("error", "cpi_token_url environment variable not defined");
      let outputMsgResp = {level: "error", server: "resource", note: "cpi_client_secret environment variable not defined"};
      console.error(JSON.stringify(outputMsgResp));
    }
    else {
      //console.info("into", "cpi_token_url environment variable is defined as", tokenUrl);
      let outputMsgResp = {level: "info", server: "resource", note: "cpi_token_url environment variable " + tokenUrl};
      console.info(JSON.stringify(outputMsgResp));
    }
    if (! cpiUrl) {
      isCpiActivated = false;
      //console.error("error", "cpi_url environment variable not defined");
      let outputMsgResp = {level: "error", server: "resource", note: "cpi_url environment variable not defined"};
      console.error(JSON.stringify(outputMsgResp));
    }
    else {
      //console.info("info", "cpi_url environment variable is defined as", cpiUrl);
      let outputMsgResp = {level: "info", server: "resource", note: "cpiUrl environment variable " + cpiUrl};
      console.info(JSON.stringify(outputMsgResp));
    }
    //console.info("info", "cpiUtils cpi access is configured", isCpiActivated);
    let outputMsgResp = {level: "info", server: "resource", note: "cpiUtils cpi access is configured " + isCpiActivated};
    console.info(JSON.stringify(outputMsgResp));
};
function isCpiConfigured() {
    return isCpiActivated;
}
/*
data is a string AL response subject entity response format.
const namespaceDeposGatewaysData is an example of the object output.
//not used in v1.1.1
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
  function parseSourceSubjectIds(apiSubjectData) {
    const result = [];
    // Iterate over the array
    apiSubjectData.forEach(item => {
      if (item.data && Array.isArray(item.data)) {
        // Iterate over the "data" array to find "id" and "metadata.depositions" objects
        item.data.forEach(dataItem => {
          if ((dataItem.id) && dataItem.kind === 'Participant') {
            // Create a new object with the id and merge it with "depositions" from metadata
            let extractedData = {source: item.source, name: dataItem.id.name};
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
function generateCpiSourceRequestBody(data) {
  const result = [];
  // Iterate over the array
  data.forEach(item => {
      // Iterate over the "data" array to find "id" and "source" as a domain
      // Create a new object with the id and source
      let tmp = {domain_name: item.source, participant_id: item.name};
      result.push(tmp);
  });
  let loadData = {participant_ids: result};
  return loadData;
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
    let outputMsgResp = {level: "error", server: "resource", endpoint: "subject-mapping", note: "API CPI communication is not configured"};
    console.error(JSON.stringify(outputMsgResp));
    return errCpiServerError;
  }
  // Get token
  let currToken = invalidToken;
  try {
    var cpiIds = generateCpiSourceRequestBody(parseSourceSubjectIds(JSON.parse(apiSubjectData)));
    if (checkArrayLength(cpiIds, "participant_ids")) {
      currToken = await getAccessToken();
      if (currToken !== invalidToken) {
        let outputMsgResp = {level: "info", server: "resource", endpoint: "subject-mapping", note: "OKTA token in API to CPI request is received", token: currToken};
        console.info(JSON.stringify(outputMsgResp));
        // start CPI request workflow
        //console.info("info IDs sent to CPI", JSON.stringify(cpiIds));
        outputMsgResp = {level: "info", ids: JSON.stringify(cpiIds)};
        console.info(JSON.stringify(outputMsgResp));
        var cpiResponse = await getCPIRequest(currToken, cpiIds);
        //var cpiResponse = await getCPIRequest(currToken, requestBodyCpi);//this is a sample data to send to CPI
        return cpiResponse;
        //return strCpiMock;//this is a sample data to return from CPI
      }
      else {
        //when no token return a prepared error JSON
        let outputMsgResp = {level: "error", server: "resource", endpoint: "subject-mapping OKTA", note: "OKTA token in API to CPI request is received"};
        console.error(JSON.stringify(outputMsgResp));
        return errCpiServerError;
      }
    }
    else {
      let outputMsgRespNotFound = {level: "error", server: "resource", endpoint: "subject-mapping", note: "Participants IDs are not found for this request"};
      console.error(JSON.stringify(outputMsgRespNotFound));
      return errCpiNotFound;
    }
  }
  catch (error) {
    //console.error("error in API to CPI workflow", error);
    let outputMsgResp = {level: "error", server: "resource", endpoint: "associated_participant_ids", note: `API to CPI workflow error: ${error.message} - ${error.code} - ${error.status}`};
    console.error(JSON.stringify(outputMsgResp));
    return errCpiServerError;
  }
}
// We assume at this fucntion that CPI is configured
async function getAccessToken() {
    try {
        const payload = "grant_type=client_credentials&scope=custom";
        //converted the data to a binary Buffer object and encodes it by Base64 algorithm.
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        //console.info("info", "Basic authentication header prepared", auth);
        let outputMsgResp = {level: "info", server: "resource", endpoint: "subject-mapping OKTA", note:"Basic authentication header prepared"};
        console.info(JSON.stringify(outputMsgResp));
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
            return accessToken;
        } else {
           //console.error("error", `failed request to get access token: ${response.status} - ${response.statusText}`);
           let outputMsgResp = {level: "error", server: "resource", endpoint: "subject-mapping OKTA", note: `failed request to get access token: ${response.status} - ${response.statusText}`};
           console.error(JSON.stringify(outputMsgResp));
           return invalidToken;
        }
    } catch (error) {
      //console.error("error", `in getting access token: ${error.message} ${error.name} ${error.statusCode}`);
      let outputMsgResp = {level: "error", server: "resource", endpoint: "subject-mapping OKTA", note: `API to OKTA request failed: ${error.message} - ${error.code} - ${error.status}`};
      console.error(JSON.stringify(outputMsgResp));
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
            //console.error(`error API request failed: ${response.status} - ${response.statusText}`);
            let outputMsgResp = {level: "error", server: "resource", endpoint: "associated_participant_ids", note: `API to CPI request failed: ${response.status} - ${response.statusText}`};
            console.error(JSON.stringify(outputMsgResp));
            return errCpiServerError;
        }
    } catch (error) {
        //console.error(`error making API request: ${error.message} ${error.name} ${error.statusCode}`);
        let outputMsgResp = {level: "error", server: "resource", endpoint: "associated_participant_ids", note: `API received CPI error: ${error.message} - ${error.code} - ${error.status}`};
        console.error(JSON.stringify(outputMsgResp));
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
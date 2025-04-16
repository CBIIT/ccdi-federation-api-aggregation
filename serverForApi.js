/*
Copyright (c) 2023, FNLCR - All rights reserved.
*/
require('newrelic');
const http = require("http");
const https = require("https");
const process = require("process");
const url = require('url');
const urlUtils = require("./app/utils/urlUtils");
const specUtils = require("./app/utils/specUtils");
const cpiUtils = require("./app/utils/cpiUtils");
const strCpiRequest = "subject-mapping";
const strSubjectRequest = "subject";

//certificates are not used, defined by setting rejectUnauthorized
// const caTreehouse = [fs.readFileSync("./treehouse-cer.pem")];
// const caPedscommons = [fs.readFileSync("./ccdifederation-pedscommons-org.pem")];
// const caStjude = [fs.readFileSync("./ccdi-stjude-cloud.pem")];

//var SERVER_HOST = "localhost";
var SERVER_HOST = "0.0.0.0" //for container from docker

const undefinedHost = "undefinedHost";
const optionsGeneral = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 9000,
  rejectUnauthorized: false
};

// hosts registration is static for now
// host are defined in env var federation_apis
// as comma-separated domains without protocol: www.server1.com,abc.server2.com,vfr.frh.server3.com
// expected are hosts from registered servers only
var apiHosts = process.env.federation_apis.split(",");
var apiSources = [];
if (process.env.federation_sources) {
  apiSources = process.env.federation_sources.split(",");
}
else {
  console.error("error", "env federation_sources is not defined");
};

var serverHost = process.env.server_host;
if (serverHost) {
  SERVER_HOST = serverHost;
  console.info("info",  "environment SERVER_HOST", SERVER_HOST);
}
console.info("info", "federation_apis", `[${apiHosts.join(', ')}]`, ", dirname:", __dirname);
console.info("info", "federation_sources", `[${apiSources.join(', ')}]`);

var apiHostSourceMap = urlUtils.mapHostToSource(apiHosts, apiSources);

const startApiUrl = "/api/v";//we do not validate the version

//CPI configuration
cpiUtils.cpiInit();
console.info("info", "cpi communication is configured", cpiUtils.isCpiConfigured());
if (! cpiUtils.isCpiConfigured()) {
  console.error("error", "configure CPI environment!");
}

function addSourceAttr(strJson, options, urlPath=startApiUrl) {
    strJson = strJson.trimStart();
    let outputMsgResp = {server: options.host, endpoint: urlPath, note: "response received"};
    console.info(JSON.stringify(outputMsgResp));
    //console.log("info", '"response received"', "server="+options.host, urlPath);
    //aggregation adds "source" attribute to all entries which are not arrays
    if ((!strJson) || (strJson === "")) {
      let outputMsg = {server: options.host, endpoint: urlPath, note: "addSourceAttr empty parameter strJson"};
      console.info(JSON.stringify(outputMsg));
      //console.info("info", "server="+options.host, '"addSourceAttr empty parameter strJson"');
      let strSource = apiHostSourceMap.get(options.host);//if source not found use host
      return ('{"source":"' + strSource+ '"}\n');
    }
    else if (urlPath.includes(strCpiRequest)) {//CPI request does not need source attribute
      return strJson;
    }
    else if ((strJson.startsWith ('{')) && (strJson.includes(":"))) {// json has at least one attribute
      //add source
      let strHost = options.host;
      let strSource = apiHostSourceMap.get(strHost);//if source not found use host
      return ('{"source":"' + strSource + '",\n ' + strJson.slice(1));
    }
    else if ((strJson.startsWith ('{')) && (!(strJson.includes(":")))) {// an empty json object
      let outputMsg = {server: options.host, note: "addSourceAttr an empty json object", endpoint: urlPath};
      console.info(JSON.stringify(outputMsg));
      //console.info("info", "server="+options.host, '"addSourceAttr an empty json object"');
      let strSource = apiHostSourceMap.get(options.host);//if source not found use host
      return ('{"source":"' + strSource+ '"}\n');
    }
    else {//array
        //console.log("debug", options.host, "addSourceAttr not added to strJson of type ", typeof(strJson), '"' + strJson + '"');
        return strJson;
    }
}

var apiVersionEnv = process.env.API_VERSION;
var projectEnv = process.env.PROJECT;
var tierEnv = process.env.tier;
console.log("info",  "environment: PROJECT", projectEnv, ", API_VERSION", apiVersionEnv, ", tier", tierEnv);
let federatedOptions = []; //HTTP options array for federation nodes calls
for(var i = 0; i < apiHosts.length;i++){
  var optionsForNode = structuredClone(optionsGeneral); //create a new options object
  optionsForNode.host = apiHosts[i];
  federatedOptions.push(optionsForNode);
}
// federatedOptions.forEach(element => {
//   console.debug("debug", federatedOptions element", element);
// });

specUtils.buildPathRegex();

var contentTypeJson = "application/json; charset=utf-8";

function addResponseHeaders (strResLength, strContent=contentTypeJson) {
  let responseObj = {"x-frame-options": "SAMEORIGIN", "x-content-type-options": "nosniff",
   "access-control-allow-origin": "*"};
  responseObj["Content-Length"] = strResLength;
  responseObj["Content-Type"] = strContent;
  return responseObj;
}
function responseLength(strResponse) {//expects a string parameter
 return Buffer.byteLength(strResponse, 'utf8') +'';
}

const server = http.createServer((req, res) => {
  const urlPath = req.url;
  const reqUrl = url.parse(urlPath, true);
  let outputMsgOrg = {server: "resource", note: "request received", endpoint: urlPath};
  console.info(JSON.stringify(outputMsgOrg));
  //console.info("info", "server="+"resource", '"request received"', "endpoint="+urlPath);
  if (!urlPath || (urlPath.length == 0) || (urlPath === '/')) {
    let data = 'CCDI Federation Resource API';
    res.writeHead(200, addResponseHeaders(responseLength(data), 'text/plain'));
    res.end(data);
  }
  else if (urlPath == "/welcome") {
    let data = 'Welcome to CCDI Federation Resource API';
    res.writeHead(200, addResponseHeaders(responseLength(data), 'text/plain'));
    res.end(data);
  } 
  else if (urlPath == "/ping") {
    let data = 'pong';
    res.writeHead(200, addResponseHeaders(responseLength(data), 'text/plain'));
    res.end(data);
  }
  else if (urlPath == "/version") {
    let data = '{"version":"'.concat(apiVersionEnv, '"}');
    res.writeHead(200, addResponseHeaders(responseLength(data), 'application/json'));
    res.end(data);
  }
  else if (! specUtils.matchPathToOpenApi(reqUrl.pathname)) {
    let data = urlUtils.getErrorStr404(urlPath);
    let outputMsg = {server: "resource", note: "response HTTP 404 invalid", endpoint: urlPath};
    //console.error("error", "server=resource", '"response HTTP 404 invalid"', "endpoint="+urlPath);
    console.error(JSON.stringify(outputMsg));
    res.writeHead(404, addResponseHeaders(responseLength(data)));
    res.end(data); 
  }//TODO more checks for valid URL Path
  else {//try to aggregate
    let outputMsgOrg = {server: "resource", note: "aggregate responses started", endpoint: urlPath};
    console.info(JSON.stringify(outputMsgOrg));
    //console.log("info", '"aggregate responses started"', "endpoint="+urlPath);
    aggregateResults(urlPath).then(data => {
      let strRes = urlUtils.concatArray(data);
      if (! urlPath.includes(strCpiRequest)) {
        let outputMsg = {server: "resource", note: "response HTTP 200 OK", endpoint: urlPath};
        //console.info("server=resource", '"response HTTP 200 OK"', "endpoint="+urlPath);
        console.info(JSON.stringify(outputMsg));
        res.writeHead(200, addResponseHeaders(responseLength(strRes)));
        res.end(strRes);
      }
      else {
        let outputMsg = {server: "resource", note: "response from CPI", endpoint: urlPath};
        //console.info("info", "server=resource", '"response from CPI"', "endpoint="+urlPath);
        console.info(JSON.stringify(outputMsg));
        //if a request was for "subject-mapping" parse IDs and return CPI result. 
        //TODO Remove Mock data
        cpiUtils.apiToCpi(strRes).then(data => {
          //console.debug("debug typeof cpiResponse", (typeof data));
          if ((data) && (data.participant_ids) && (Array.isArray(data.participant_ids))) {
            let outputMsgCpi = {server: "resource", note: "received number of CPI IDs " + (data.participant_ids.length)};
            //console.info("info received number of CPI IDs", (data.participant_ids.length));
            console.info(JSON.stringify(outputMsgCpi));
          }
          let strRes = JSON.stringify(data);
          res.writeHead(200, addResponseHeaders(responseLength(strRes)));
          res.end(strRes);
        })
      }
    });
  }
});

function getresultHttp(optionsNode, urlPath, proto, addSourceInfo = false) {
  return new Promise ((resolve, reject) => {
    let chunks = '';
    var options = structuredClone(optionsNode);
    options.path = urlPath;
    //console.debug("debug", "options", options);
    //implement CPI communication
    if (urlPath.includes(strCpiRequest)) {
      //TODO make more granual comparison
      let outputMsg = {server: "resource", note: "CPI request received", endpoint: urlPath};
      //console.info("info", "CPI request received", urlPath, urlPath.replace(strCpiRequest, strSubjectRequest));
      console.info(JSON.stringify(outputMsg));
      options.path = urlPath.replace(strCpiRequest, strSubjectRequest);
      console.debug("options.path replaced",options.path);
    }
    const req = proto.request(options, (res) => {
      //console.log("info", "statusCode: ", res.statusCode); // <======= Here's the status code
      //console.log("debug", "headers", JSON.stringify(res.headers));
      let outputMsg = {server: optionsNode.host, endpoint: options.path, note: "request to federation node"};
      //console.info("info", '"request to"', "server="+optionsNode.host, "endpoint="+options.path);
      console.info(JSON.stringify(outputMsg));
      res.on('data', chunk => {
        chunks+= chunk;
      });
      res.on('end', () => {
        //filter our responses with text/html body
        let strContentType = res.headers["content-type"];
        if ((res.statusCode < 500) && (strContentType != null) &&(strContentType.includes("text/html"))) {
          let outputMsgErr = {note: "HTML received", server: optionsNode.host, endpoint: urlPath, status:res.statusCode, body: chunks};
          //console.error("error", "server="+options.host, "status="+res.statusCode, "endpoint="+urlPath, '"HTML received"', chunks);
          console.error(JSON.stringify(outputMsgErr));
          outputMsgErr = {note: "resource generated a federation server response for received HTML", server: "resourse", endpoint: urlPath};
          // console.error("error", "resource generated on HTTP response 404", "server="+options.host, "endpoint="+urlPath);
          console.error(JSON.stringify(outputMsgErr));
          chunks = urlUtils.getErrorStr404(urlPath);//replace HTML responses with error json
        }
        else if ((res.statusCode < 500) && (res.statusCode > 200)) {
          //not OK response from Federation Node to be logged to console
          //this include not implemented responses which can be expected.
          let outputMsgErr = {server: optionsNode.host, endpoint: urlPath, status: res.statusCode, note: "Received not OK HTTP status code", body: chunks};
          console.error(JSON.stringify(outputMsgErr));
          //console.error("error", "server="+options.host, "status="+res.statusCode, "endpoint="+urlPath, '"Received not OK HTTP status code"', chunks);
        }
        //replace non-json responses with error json
        if ((res.statusCode >= 500) && 
          ((strContentType != null) && (! strContentType.includes("application/json")) || (! strContentType))) {
          let outputMsgErr = {server: optionsNode.host, endpoint: urlPath, status: res.statusCode, note: "Server Error received", body: chunks};
          console.error(JSON.stringify(outputMsgErr));
          //console.error("error", "server="+options.host, "status="+res.statusCode, "Server Error received", chunks);
          chunks = urlUtils.getErrorStr500(urlPath);
        }
        else if (res.statusCode >= 500) {
          //Federation Node server error response to be logged to console
          let outputMsgErr = {server: optionsNode.host, endpoint: urlPath, status: res.statusCode, note: "Received server error HTTP status code", body: chunks};
          console.error(JSON.stringify(outputMsgErr));
          //console.error("error", "server="+options.host, "status="+res.statusCode, "endpoint="+urlPath, '"Received server error HTTP status code"', chunks);
        }
        try {
          if (addSourceInfo) //this is until added to original federation responses
            chunks = addSourceAttr(chunks,options,urlPath);
          resolve(chunks);
        } catch (err) {
          let outputMsgErr = {server: optionsNode.host, endpoint: urlPath, status: res.statusCode, note: "error res.on in getresultHttp from host", message: err.message};
          console.error(JSON.stringify(outputMsgErr));
          //console.error("error", "server="+options.host, "message="+err.message, '"error res.on in getresultHttp from host"');
          console.error(err);
          //errorJson.message = err.message;       
          resolve(addSourceAttr(urlUtils.getErrorStr500(urlPath), options, urlPath));
        };
      });
    });
    req.on('timeout', () => {
        let outputMsgErr = {server: optionsNode.host, endpoint: urlPath, note: "timeout from host"};
        console.error(JSON.stringify(outputMsgErr));
        //console.error("error", '"timeout from host"', "server="+options.host);
        let dataTimeout = urlUtils.getErrorStrTimeout(urlPath);
        dataTimeout = addSourceAttr(dataTimeout,options,urlPath);
        resolve(dataTimeout);
        req.destroy();
    });
    req.on('error', err => {
      let outputMsgErr = {server: optionsNode.host, endpoint: urlPath, note: "error from host", message: err.message};
      console.error(JSON.stringify(outputMsgErr));
      //console.error("error", '"error from host"', "server="+options.host, "message="+err.message);
      resolve(addSourceAttr(err, options, urlPath));
    });
    req.end();
  });
}

function aggregateRequests(urlPath) {
  let toAggregate = [];
  let addSourceToResponse = true;//add 'source' attribute to endpont responses
  //collect Promises from getresultHttp
  for(var element of federatedOptions)
  {
    toAggregate.push(getresultHttp(element, urlPath, https, addSourceToResponse));
  }
  return Promise.all(toAggregate);
  //This was a test for one space
  //let requestChop = getresultHttp(optionsChop, urlPath, http);//Promise
  //return Promise.all([requestChop]);
}
async function aggregateResults(urlPath){
  //this is a direct test
  //return res = await getresultHttp(optionsChop, urlPath);//this works
  return res = await aggregateRequests(urlPath);
}

server.listen(3000, SERVER_HOST, () => {
  console.log("CCDI Federation API Aggregation service listening for requests");
  console.log('Port :' + server.address().port);
  console.log('Server:' + server.address().address);
});

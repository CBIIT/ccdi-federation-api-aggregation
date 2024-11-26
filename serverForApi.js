/*
Copyright (c) 2023, FNLCR - All rights reserved.
*/
require('newrelic');
const http = require("http");
const https = require("https");
const process = require("process");
const fs = require('fs');
const urlUtils = require("./app/utils/urlUtils");

//certificates are not used, defined by setting rejectUnauthorized
// const caTreehouse = [fs.readFileSync("./treehouse-cer.pem")];
// const caPedscommons = [fs.readFileSync("./ccdifederation-pedscommons-org.pem")];
// const caStjude = [fs.readFileSync("./ccdi-stjude-cloud.pem")];

//var SERVER_HOST = "localhost";
var SERVER_HOST = "0.0.0.0" //for container from docker

var undefinedHost = "undefinedHost";
var optionsTreehouse = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 4000,
  rejectUnauthorized: false//,
  //ca: caTreehouse
};
var optionsPedscommons = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 4000,
  rejectUnauthorized: false//,
  //ca: caPedscommons
};
var optionsChop = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 9000
};
var optionsStjude = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 4000,
  rejectUnauthorized: false//,
  //ca: caStjude
};
// hosts registration is static for now
// host are defined in env var federation_apis
// as comma-separated domains without protocol: www.server1.com, abc.server2.com, vfr.frh.server3.com
// expected are hosts from registered servers only
var apiHosts = process.env.federation_apis.split(",");
var serverHost = process.env.server_host;
if (serverHost) {
  SERVER_HOST = serverHost;
}
console.log("info", apiHosts, __dirname);
var apiVersionEnv = process.env.API_VERSION;
var projectEnv = process.env.PROJECT;
var tierEnv = process.env.tier;
console.log("info",  "environment: PROJECT", projectEnv, ", API_VERSION", apiVersionEnv, ", tier", tierEnv);

for(var i = 0; i < apiHosts.length;i++){
  if (apiHosts[i].includes("pedscommons"))
    optionsPedscommons.host = apiHosts[i];
  else if (apiHosts[i].includes("stjude"))
    optionsStjude.host = apiHosts[i];    
  else if (apiHosts[i].includes("kidsfirst"))
    optionsChop.host = apiHosts[i];
  else if (apiHosts[i].includes("treehouse"))
    optionsTreehouse.host = apiHosts[i];
}

var regKidsFirst = new RegExp("Kid.*s.*First.*DRC");
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
  console.log("info", "server="+"resource", '"request received"', "endpoint="+urlPath);
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
  else if (! urlUtils.validEndpoint(urlPath)) {
    let data = urlUtils.getErrorStr404(urlPath);
    console.error("error", "server="+"resource", '"response HTTP 404 invalid"', "endpoint="+urlPath);
    res.writeHead(404, addResponseHeaders(responseLength(data)));
    res.end(data); 
  }//TODO more checks for valid URL Path
  else {//try to aggregate
    console.log("info", '"aggregate responses started"', "endpoint="+urlPath);
    aggregateResults(urlPath).then(data => {
     let strRes = urlUtils.concatArray(data);
     res.writeHead(200, addResponseHeaders(responseLength(strRes)));
     console.log("info", "server="+"resource", '"response HTTP 200 OK"', "endpoint="+urlPath);
     res.end(strRes);
    });
  }
});

function getresultHttp(optionsNode, urlPath, proto, addSourceInfo = false) {
  return new Promise ((resolve, reject) => {
    let chunks = '';
    var options = structuredClone(optionsNode);
    options.path = urlPath;
    const req = proto.request(options, (res) => {
      //console.log("info", "statusCode: ", res.statusCode); // <======= Here's the status code
      //console.log("debug", "headers", JSON.stringify(res.headers));
      console.log("info", '"request to"', "server="+optionsNode.host, "endpoint="+urlPath);
      res.on('data', chunk => {
        chunks+= chunk;
      });
      res.on('end', () => {
        //filter our responses with text/html body
        let strContentType = res.headers["content-type"];
        if ((res.statusCode < 500) && (strContentType != null) &&(strContentType.includes("text/html"))) {
          console.error("error", "server="+options.host, "status="+res.statusCode, "endpoint="+urlPath, '"HTML received"', chunks);
          console.error("error", "resource generated on HTTP response 404", "server="+options.host, "endpoint="+urlPath);
          chunks = urlUtils.getErrorStr404(urlPath);
        }
        else if ((res.statusCode < 500) && (res.statusCode > 200)) {
          //not OK response from Federation Node to be logged to console
          //this include not implemented responses which can be expected.
          console.error("error", "server="+options.host, "status="+res.statusCode, "endpoint="+urlPath, '"Received not OK HTTP status code"', chunks);
        }
        //replace non-json responses with error json
        if ((res.statusCode >= 500) && 
          ((strContentType != null) && (! strContentType.includes("application/json")) || 
          (! strContentType))) {
          console.error("error", "server="+options.host, "status="+res.statusCode, "Server Error received", chunks);
          chunks = urlUtils.getErrorStr500(urlPath);
        }
        else if (res.statusCode >= 500) {
          //Federation Node server error response to be logged to console
          console.error("error", "server="+options.host, "status="+res.statusCode, "endpoint="+urlPath, '"Received server error HTTP status code"', chunks);
        }
        try {
          if (addSourceInfo) //this is until added to original federation responses
            chunks = urlUtils.addSourceAttr(chunks,options,urlPath);
          resolve(chunks);
        } catch (err) {
          console.error("error", "server="+options.host, "message="+err.message, '"error res.on in getresultHttp from host"');
          console.error(err);
          //errorJson.message = err.message;       
          resolve(urlUtils.addSourceAttr(err.message,options,urlPath));
        };
      });
    });
    req.on('timeout', () => {
        console.error("error", '"timeout from host"', "server="+options.host);
        let dataTimeout = urlUtils.getErrorStrTimeout(urlPath, urlUtils.findRequestSource(options.host));
        dataTimeout = urlUtils.addSourceAttr(dataTimeout,options,urlPath);
        resolve(dataTimeout);
        req.destroy();
    });
    req.on('error', err => {
      console.error("error", '"error from host"', "server="+options.host, "message="+err.message);
      resolve(urlUtils.addSourceAttr(err.message,options,urlPath));
    });
    req.end();
  });
}

function aggregateRequests(urlPath) {
  let toAggregate = [];
  let addSourceToResponse = true;//add 'source' attribute to endpont responses
  //collect Promises from getresultHttp
  if (optionsChop.host !== undefinedHost) {
    toAggregate.push(getresultHttp(optionsChop, urlPath, https, addSourceToResponse));
  }
  if (optionsPedscommons.host !== undefinedHost)
    toAggregate.push(getresultHttp(optionsPedscommons, urlPath, https, addSourceToResponse));
  if (optionsTreehouse.host !== undefinedHost)
    toAggregate.push(getresultHttp(optionsTreehouse, urlPath, https, addSourceToResponse));
  if (optionsStjude.host !== undefinedHost) {
    toAggregate.push(getresultHttp(optionsStjude, urlPath, https, addSourceToResponse));
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

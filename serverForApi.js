/*
Copyright (c) 2023, FNLCR - All rights reserved.
*/
const http = require("http");
const https = require("https");
const process = require("process");
const fs = require('fs');
const urlUtils = require("./app/utils/urlUtils");

//certificate loading is static as of now
const caTreehouse = [fs.readFileSync("./treehouse-cer.pem")];
const caPedscommons = [fs.readFileSync("./ccdifederation-pedscommons-org.pem")];
const caStjude = [fs.readFileSync("./ccdi-stjude-cloud.pem")];

var SERVER_HOST = "localhost" //"0.0.0.0" for container from docker

var undefinedHost = "undefinedHost";
var optionsTreehouse = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 2000,
  rejectUnauthorized: false,
  ca: caTreehouse
};
var optionsPedscommons = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 2000,
  rejectUnauthorized: false,
  ca: caPedscommons
};
var optionsChop = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 3000
};
var optionsStjude = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 2000,
  rejectUnauthorized: false,
  ca: caStjude
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
console.log(apiHosts ); //TODO remove log

for(var i = 0; i < apiHosts.length;i++){
  if (apiHosts[i].includes("pedscommons"))
    optionsPedscommons.host = apiHosts[i];
  else if (apiHosts[i].includes("stjude"))
    optionsStjude.host = apiHosts[i];    
  else if (apiHosts[i].includes("chop"))
    optionsChop.host = apiHosts[i];
  else if (apiHosts[i].includes("treehouse"))
    optionsTreehouse.host = apiHosts[i];
}

var regKidsFirst = new RegExp("Kid.*s.*First.*DRC");
var contentTypeJson = "application/json; charset=utf-8";

const server = http.createServer((req, res) => {
  const urlPath = req.url;
  console.log('Request with urlPath: ', urlPath);
  let isTreehouseUrl = (urlPath.indexOf('ucsc-treehouse') > 0) || (urlPath.indexOf('ucsc-xena') > 0);
  let isPedscommonsUrl = urlPath.indexOf('pedscommons') > 0;
  let isKidsFirstUrl = regKidsFirst.test(urlPath);
  let isStjudeUrl = urlPath.indexOf('stjude') > 0; //StJude not implemented
  //console.log('isTreehouseUrl: ', isTreehouseUrl, 'isPedscommonsUrl: ', isPedscommonsUrl,
  //'isKidsFirstUrl: ', isKidsFirstUrl, 'isStjudeUrl: ', isStjudeUrl);
  function addResponseHeaders (strResLength) {
     let responseObj = { "Content-Type": contentTypeJson,  
      "x-frame-options": "SAMEORIGIN", "x-content-type-options": "nosniff",
      "access-control-allow-origin": "*"};
     responseObj["Content-Length"] = strResLength;
     return responseObj;
  }
  function responseLength(strResponse) {//expects a string parameter
    return Buffer.byteLength(strResponse, 'utf8') +'';
  }
  if (!urlPath || (urlPath.length == 0) || (urlPath === '/')) {
    res.writeHead(200, addResponseHeaders(37));
    res.end('CCDI Federation API Aggregation Layer');
  }
  else if (urlPath == "/welcome") {
    res.writeHead(200, addResponseHeaders(42));
    res.end('Welcome to CCDI Federation API Aggregation');
  }   
  else if (! urlUtils.validEndpoint(urlPath)) {
    res.writeHead(404, {"Content-Type": "text/plain", "Content-Length":"9"});
    res.end('Not Found');
  }
  else if (isTreehouseUrl&&(optionsTreehouse.host !== undefinedHost)) {
      console.log("Treehouse request: ", urlPath);
      getresultHttp(optionsTreehouse, urlPath, https).then(data => {
      res.writeHead(200, addResponseHeaders(responseLength(data)));
      res.end(data);
    });//TODO check for valid URL Path
  } else if (isPedscommonsUrl&&(optionsPedscommons.host !== undefinedHost)) {
      console.log("Pedscommons request: ", urlPath);
      getresultHttp(optionsPedscommons, urlPath, https).then(data => {
      res.writeHead(200, addResponseHeaders(responseLength(data)));
      res.end(data);
    });
  } else if (isStjudeUrl&&(optionsStjude.host !== undefinedHost)) {
      console.log("Stjude request: ", urlPath);
      getresultHttp(optionsStjude, urlPath, https).then(data => {
      res.writeHead(200, addResponseHeaders(responseLength(data)));
      res.end(data);
    });
  } else if (isKidsFirstUrl &&(optionsChop.host !== undefinedHost)) {
      let urlTemp = urlPath;//TODO remove when the server is fixed
      if (urlPath.startsWith("/api/v0/")) {
        urlTemp = urlPath.replace("/api/v0/", "/chop-ccdi-api-dev/api/");
      }
      console.log("KidsFirst request: ", urlTemp);
      getresultHttp(optionsChop, urlTemp, http).then(data => {
      res.writeHead(200, addResponseHeaders(responseLength(data)));
      res.end(data);
    });
  }else {//try to aggregate
      console.log("aggregate results request: ", urlPath);
      aggregateResults(urlPath).then(data => {
      let strRes = urlUtils.concatArray(data);
      res.writeHead(200, addResponseHeaders(responseLength(strRes)));
      res.end(strRes);
    });
  }
});

function getresultHttp(options, urlPath, proto, addSourceInfo = false) {
  let errJson = urlUtils.getDomain(options.host);
  let errorJson = new Object();
  errorJson.errorOrigin = errJson;
  errorJson.message = '';

  return new Promise ((resolve, reject) => {   
    let chunks = '';
    options.path = urlPath;
    const req = proto.request(options, (res) => {
      //console.log("statusCode: ", res.statusCode); // <======= Here's the status code
      //console.log("headers: ", res.headers);
      res.on('data', chunk => {
        chunks+= chunk;
      });
      res.on('end', () => {
        try {
          if (addSourceInfo) //this is until added to original federation responses
            chunks = urlUtils.addSourceAttr(chunks,options);
          resolve(chunks);
        } catch (err) {
          console.error('error res.on: ', options.host, err.message);
          errorJson.message = err.message;
          resolve(JSON.stringify(errorJson));
        };
      });

    });
    req.on('timeout', () => {
        console.error('timeout: ', options.host);
        errorJson.message = errorJson.message + ' timeout';
        resolve(JSON.stringify(errorJson));
        req.destroy();
    });
    req.on('error', err => {
      console.error('error req: ', options.host, err.message);
      errorJson.message += err.message;
      resolve(JSON.stringify(errorJson));
    });
    req.end();
  });
}

function aggregateRequests(urlPath) {
  let toAggregate = [];
  //collect Promises from getresultHttp
  if (optionsChop.host !== undefinedHost) {
    let urlTemp = urlPath;//TODO remove when the server is fixed
    if (urlPath.startsWith("/api/v0/")) {
      urlTemp = urlPath.replace("/api/v0/", "/chop-ccdi-api-dev/api/");
    }   
    toAggregate.push(getresultHttp(optionsChop, urlTemp, http, true));
  } 
  if (optionsPedscommons.host !== undefinedHost)
    toAggregate.push(getresultHttp(optionsPedscommons, urlPath, https, true));
  if (optionsTreehouse.host !== undefinedHost)
    toAggregate.push(getresultHttp(optionsTreehouse, urlPath, https, true));
  if (optionsStjude.host !== undefinedHost) {
    toAggregate.push(getresultHttp(optionsStjude, urlPath, https, true));
  }
  
  return Promise.all(toAggregate);
  //This was a test for one space
  //let requestChop = getresultHttp(optionsChop, urlPath, http);//Promise
  //return Promise.all([requestChop]);
}
async function aggregateResults(urlPath){
  //console.log('aggregateResults started:', urlPath);
  //this is a direct test
  //return res = await getresultHttp(optionsChop, urlPath);//this works
  return res = await aggregateRequests(urlPath);
}

server.listen(3000, SERVER_HOST, () => {
  console.log("Listening for request on port 3000");
  console.log('Port :' + server.address().port);
  console.log('Server:' + server.address().address);
});
